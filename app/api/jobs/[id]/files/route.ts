import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/access";
import { deleteObject } from "@/lib/storage";
import { z } from "zod";

const schema = z.object({
  kind: z.enum(["RAW", "EDITED"]),
  filename: z.string().min(1),
  storageKey: z.string().min(1),
  sizeBytes: z.number().optional(),
  contentType: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;
  const { id: jobId } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { kind, filename, storageKey, sizeBytes, contentType } = parsed.data;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed =
    (kind === "RAW" && (job.createdById === viewer.id || viewer.role === "OWNER")) ||
    (kind === "EDITED" && job.supplierId === viewer.id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const file = await prisma.jobFile.create({
    data: {
      jobId,
      kind,
      filename,
      storageKey,
      sizeBytes,
      contentType,
      uploadedById: viewer.id,
    },
  });

  // Supplier adding their first edited file moves the job out of the "waiting" state.
  if (kind === "EDITED" && job.status === "UPLOADED") {
    await prisma.job.update({ where: { id: jobId }, data: { status: "IN_PROGRESS" } });
  }

  return NextResponse.json({ id: file.id }, { status: 201 });
}

const deleteAllSchema = z.object({ kind: z.enum(["RAW", "EDITED"]) });

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;
  const { id: jobId } = await params;

  const parsed = deleteAllSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { kind } = parsed.data;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed =
    viewer.role === "OWNER" ||
    (kind === "RAW" && job.createdById === viewer.id) ||
    (kind === "EDITED" && job.supplierId === viewer.id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const files = await prisma.jobFile.findMany({ where: { jobId, kind } });
  await Promise.all(files.map((f) => deleteObject(f.storageKey)));
  await prisma.jobFile.deleteMany({ where: { jobId, kind } });

  return NextResponse.json({ ok: true, deleted: files.length });
}