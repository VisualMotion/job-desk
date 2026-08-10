import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jobScopeFor, SessionUser } from "@/lib/access";
import { getDownloadUrl } from "@/lib/storage";
import { z } from "zod";

const schema = z.object({ fileId: z.string() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const file = await prisma.jobFile.findUnique({
    where: { id: parsed.data.fileId },
    include: { job: true },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const job = await prisma.job.findFirst({
    where: { id: file.jobId, ...jobScopeFor(viewer) },
  });
  if (!job) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (viewer.role === "SUPPLIER" && file.kind === "RAW" && !job.rawDownloadedAt) {
    await prisma.job.update({ where: { id: job.id }, data: { rawDownloadedAt: new Date() } });
  }

  const url = await getDownloadUrl(file.storageKey, file.filename);
  return NextResponse.json({ url });
}
