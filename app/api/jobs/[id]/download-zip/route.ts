import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jobScopeFor, SessionUser } from "@/lib/access";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import archiver from "archiver";
import { Readable, PassThrough } from "stream";

export const runtime = "nodejs";
export const maxDuration = 800;

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME!;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;
  const { id: jobId } = await params;

  const kind = req.nextUrl.searchParams.get("kind");
  if (kind !== "RAW" && kind !== "EDITED") {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const job = await prisma.job.findFirst({ where: { id: jobId, ...jobScopeFor(viewer) } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const files = await prisma.jobFile.findMany({
    where: { jobId, kind },
    orderBy: { filename: "asc" },
  });
  if (files.length === 0) {
    return NextResponse.json({ error: "No files to download" }, { status: 400 });
  }

  const archive = archiver("zip", { store: true });

  const passthrough = new PassThrough();
  archive.pipe(passthrough);
  archive.on("error", (err) => {
    console.error("Archive error:", err);
    passthrough.destroy(err);
  });

  (async () => {
    for (const f of files) {
      try {
        const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: f.storageKey }));
        const webBody = await obj.Body!.transformToWebStream();
        const nodeStream = Readable.fromWeb(webBody as any);
        archive.append(nodeStream, { name: f.filename });
      } catch (err) {
        console.error(`Failed to add ${f.filename} to zip:`, err);
      }
    }
    archive.finalize();
  })();

  const webStream = Readable.toWeb(passthrough) as ReadableStream;
  const safeName = `${job.reference}-${kind.toLowerCase()}`.replace(/[^a-zA-Z0-9.\-_]/g, "_");

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}.zip"`,
    },
  });
}
