import { PrismaClient } from "@prisma/client";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME!;

async function main() {
  const files = await prisma.jobFile.findMany({
    orderBy: { createdAt: "asc" },
  });

  const seen = new Map<string, string>();
  const toDelete: { id: string; storageKey: string; filename: string }[] = [];

  for (const f of files) {
    const key = `${f.jobId}|${f.kind}|${f.filename}`;
    if (seen.has(key)) {
      toDelete.push({ id: f.id, storageKey: f.storageKey, filename: f.filename });
    } else {
      seen.set(key, f.id);
    }
  }

  if (toDelete.length === 0) {
    console.log("No duplicates found.");
    return;
  }

  console.log(`Found ${toDelete.length} duplicate file record(s). Removing...`);

  for (const f of toDelete) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: f.storageKey }));
    } catch (err) {
      console.warn(`Couldn't delete storage object for ${f.filename} (may already be gone):`, err);
    }
  }

  const result = await prisma.jobFile.deleteMany({
    where: { id: { in: toDelete.map((f) => f.id) } },
  });

  console.log(`Removed ${result.count} duplicate file record(s) and their storage objects.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
