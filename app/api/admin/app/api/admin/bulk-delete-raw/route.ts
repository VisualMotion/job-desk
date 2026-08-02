import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/access";
import { deleteObject } from "@/lib/storage";
import { z } from "zod";

const schema = z.object({
  cutoffDate: z.string(),
  dryRun: z.boolean().default(true),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;
  if (viewer.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { cutoffDate, dryRun } = parsed.data;

  const cutoff = new Date(cutoffDate);
  cutoff.setHours(23, 59, 59, 999);

  const eligibleJobs = await prisma.job.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { lte: cutoff },
    },
    select: { id: true, reference: true },
  });

  const jobIds = eligibleJobs.map((j) => j.id);

  const files = await prisma.jobFile.findMany({
    where: { jobId: { in: jobIds }, kind: "RAW" },
  });

  const totalBytes = files.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      jobsAffected: eligibleJobs.length,
      filesToDelete: files.length,
      approxBytesFreed: totalBytes,
    });
  }

  await Promise.all(files.map((f) => deleteObject(f.storageKey)));
  await prisma.jobFile.deleteMany({ where: { id: { in: files.map((f) => f.id) } } });

  return NextResponse.json({
    dryRun: false,
    jobsAffected: eligibleJobs.length,
    filesDeleted: files.length,
    approxBytesFreed: totalBytes,
  });
}
