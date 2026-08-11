import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/access";
import { deleteObject } from "@/lib/storage";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;
  const { id: jobId, fileId } = await params;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const file = await prisma.jobFile.findFirst({ where: { id: fileId, jobId } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed =
    viewer.role === "OWNER" ||
    (file.kind === "RAW" && job.createdById === viewer.id) ||
    (file.kind === "EDITED" && job.supplierId === viewer.id);

  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await deleteObject(file.storageKey);
  await prisma.jobFile.delete({ where: { id: fileId } });

  return NextResponse.json({ ok: true });
}