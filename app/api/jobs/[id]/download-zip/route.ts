import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jobScopeFor, SessionUser } from "@/lib/access";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import archiver from "archiver";
import { Readable, PassThrough } from "stream";
import https from "https";

export const runtime = "nodejs";
export const maxDuration = 800;

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestHandler: new NodeHttpHandler({
    requestTimeout: 30_000,
    connectionTimeout: 10_000,
    httpsAgent: new https.Agent({ keepAlive: false }),
  }),
});
const BUCKET = process.env.R2_BUCKET_NAME!;

async function fetchFileWithRetry(storageKey: string, filename: string, attempts = 3): Promise<Readable> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: storageKey }));
      const webBody = await obj.Body!.transformToWebStream();
      return Readable.fromWeb(webBody as any);
    } catch (err) {
      lastErr = err;
      console.error(`[download-zip] attempt ${attempt}/${attempts} failed for ${filename}:`, err);
    }
  }
  throw lastErr;
}

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
    if (bytesToClient % 20_000_000 < chunk.length) {
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

  (async () => {
    for (const f of files) {
      try {
        const nodeStream = await fetchFileWithRetry(f.storageKey, f.filename);
        archive.append(nodeStream, { name: f.filename });
      } catch (err) {
        console.error(`[download-zip] giving up on ${f.filename} after retries:`, err);
      }
    }
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
