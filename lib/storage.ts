import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

// Cloudflare R2 is S3-compatible. Works identically with real AWS S3 if preferred.
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT, // e.g. https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

export function buildStorageKey(jobId: string, kind: "raw" | "edited", filename: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return `jobs/${jobId}/${kind}/${randomUUID()}-${safeName}`;
}

// Presigned URL the browser uploads directly to. Expires quickly since it's single-use.
export async function getUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes
}

// Presigned URL for a scoped, time-limited download. Never expose permanent public URLs -
// this is what keeps a supplier's link from working for a contractor's file and vice versa.
export async function getDownloadUrl(key: string, downloadFilename?: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: downloadFilename
      ? `attachment; filename="${downloadFilename}"`
      : undefined,
  });
  return getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}