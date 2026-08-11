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

  console.log(`[download-zip] starting: ${files.length} files for job ${job.reference}`);

  const archive = archiver("zip", { store: true });
  const passthrough = new PassThrough();

  let bytesToClient = 0;
  passthrough.on("data", (chunk) => {
    bytesToClient += chunk.length;
    if (bytesToClient % 5_000_000 < chunk.length) {
      console.log(`[download-zip] ${bytesToClient} bytes sent to client so far`);
    }
  });
  passthrough.on("end", () => console.log(`[download-zip] passthrough ended, total ${bytesToClient} bytes`));
  passthrough.on("error", (err) => console.error("[download-zip] passthrough error:", err));

  archive.pipe(passthrough);
  archive.on("error", (err) => {
    console.error("[download-zip] archive error:", err);
    passthrough.destroy(err);
  });
  archive.on("entry", (entry) => console.log(`[download-zip] archive finished entry: ${entry.name}`));
  archive.on("warning", (warn) => console.warn("[download-zip] archive warning:", warn));

  (async () => {
    console.log("[download-zip] background loop starting");
    for (const f of files) {
      try {
        console.log(`[download-zip] fetching ${f.filename} from R2`);
        const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: f.storageKey }));
        console.log(`[download-zip] got R2 response for ${f.filename}, converting stream`);
        const webBody = await obj.Body!.transformToWebStream();
        const nodeStream = Readable.fromWeb(webBody as any);
        console.log(`[download-zip] appending ${f.filename} to archive`);
        archive.append(nodeStream, { name: f.filename });
      } catch (err) {
        console.error(`[download-zip] failed to add ${f.filename}:`, err);
      }
    }
    console.log("[download-zip] all files appended, finalizing");
    archive.finalize();
  })().catch((err) => console.error("[download-zip] background loop crashed:", err));

  const webStream = Readable.toWeb(passthrough) as ReadableStream;
  const safeName = `${job.reference}-${kind.toLowerCase()}`.replace(/[^a-zA-Z0-9.\-_]/g, "_");

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}.zip"`,
    },
  });
}
