import { prisma } from "@/lib/prisma";
import { Prisma, Role } from "@prisma/client";

export type SessionUser = { id: string; role: Role; name: string; email: string };

/**
 * Returns the Prisma `where` clause that scopes the jobs a given user is allowed
 * to see at all. This is the enforcement point for "my jobs are separated from
 * the contractors' jobs" and "suppliers only see their assigned jobs."
 */
export function jobScopeFor(user: SessionUser): Prisma.JobWhereInput {
  switch (user.role) {
    case "OWNER":
      return {}; // owner sees everything
    case "CONTRACTOR":
      return { createdById: user.id }; // only jobs they personally submitted
    case "SUPPLIER":
      return { supplierId: user.id }; // only jobs assigned to them
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

/**
 * Strips identity fields depending on who is looking at the job. This is what
 * enforces "no details of the suppliers can be visible to the contractors and
 * vice versa" at the data layer, not just in the UI.
 */
export function serializeJobForViewer(job: JobWithRelations, viewer: SessionUser) {
  const base = {
    id: job.id,
    reference: job.reference,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
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
    // Owner is the only party who legitimately sees both sides.
    return {
      ...base,
      title: job.title,
      createdBy: { name: job.createdBy.name, role: job.createdBy.role },
      supplier: { name: job.supplier.name, email: job.supplier.email },
    };
  }

  if (viewer.role === "CONTRACTOR") {
    // Never reveal which supplier is editing the job, or any supplier detail.
    return {
      ...base,
      title: job.title,
      createdBy: { name: job.createdBy.name, role: job.createdBy.role },
      supplier: null,
    };
  }

  // SUPPLIER: never reveal who created the job beyond a generic label -
  // in particular, never reveal a contractor's identity.
  return {
    ...base,
    title: null,
    createdBy: null,
    supplier: { name: job.supplier.name, email: job.supplier.email },
  };
}

export async function getJobForViewer(jobId: string, viewer: SessionUser) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, ...jobScopeFor(viewer) },
    include: jobInclude,
  });
  if (!job) return null; // scoping means "not visible" and "doesn't exist" look identical
  return serializeJobForViewer(job, viewer);
}
