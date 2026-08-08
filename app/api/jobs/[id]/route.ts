import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getJobForViewer, SessionUser } from "@/lib/access";
import { deleteObject } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;

  const { id } = await params;
  const job = await getJobForViewer(id, viewer);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(job);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;
  if (viewer.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id }, include: { files: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await Promise.all(job.files.map((f) => deleteObject(f.storageKey)));

  await prisma.job.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
