import { prisma } from "@/lib/prisma";
import { Prisma, Role } from "@prisma/client";

export type SessionUser = { id: string; role: Role; name: string; email: string };

export function jobScopeFor(user: SessionUser): Prisma.JobWhereInput {
  switch (user.role) {
    case "OWNER":
      return {};
    case "CONTRACTOR":
      return { createdById: user.id };
    case "SUPPLIER":
      return { supplierId: user.id };
  }
}

const jobWithRelations = Prisma.validator<Prisma.JobDefaultArgs>()({
  include: {
    createdBy: { select: { id: true, name: true, email: true, role: true } },
    supplier: { select: { id: true, name: true, email: true } },
    files: true,
  },
});
export type JobWithRelations = Prisma.JobGetPayload<typeof jobWithRelations>;
export const jobInclude = jobWithRelations.include;

export function serializeJobForViewer(job: JobWithRelations, viewer: SessionUser) {
  const base = {
    id: job.id,
    reference: job.reference,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    dueDate: job.dueDate,
    rawDownloadedAt: job.rawDownloadedAt,
    notes: job.notes,
    files: job.files.map((f) => ({
      id: f.id,
      kind: f.kind,
      filename: f.filename,
      sizeBytes: f.sizeBytes,
      createdAt: f.createdAt,
    })),
  };

  if (viewer.role === "OWNER") {
    return {
      ...base,
      title: job.title,
      createdBy: job.createdBy
        ? { name: job.createdBy.name, role: job.createdBy.role }
        : { name: "Removed account", role: "CONTRACTOR" as const },
      supplier: job.supplier
        ? { name: job.supplier.name, email: job.supplier.email }
        : { name: "Removed account", email: "" },
    };
  }

  if (viewer.role === "CONTRACTOR") {
    return {
      ...base,
      title: job.title,
      createdBy: job.createdBy
        ? { name: job.createdBy.name, role: job.createdBy.role }
        : { name: "Removed account", role: "CONTRACTOR" as const },
      supplier: null,
    };
  }

  return {
    ...base,
    title: job.title,
    createdBy: null,
    supplier: job.supplier
      ? { name: job.supplier.name, email: job.supplier.email }
      : { name: "Removed account", email: "" },
  };
}

export async function getJobForViewer(jobId: string, viewer: SessionUser) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, ...jobScopeFor(viewer) },
    include: jobInclude,
  });
  if (!job) return null;
  return serializeJobForViewer(job, viewer);
}
