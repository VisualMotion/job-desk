import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jobScopeFor, jobInclude, serializeJobForViewer, SessionUser } from "@/lib/access";
import { sendNewJobEmail } from "@/lib/email";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;

  const jobs = await prisma.job.findMany({
    where: jobScopeFor(viewer),
    include: jobInclude,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(jobs.map((j) => serializeJobForViewer(j, viewer)));
}

const createJobSchema = z.object({
  title: z.string().min(1),
  supplierId: z.string().min(1),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;

  // Only owner and contractors submit jobs; suppliers receive them.
  if (viewer.role !== "OWNER" && viewer.role !== "CONTRACTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, supplierId, notes } = parsed.data;

  const supplier = await prisma.user.findUnique({ where: { id: supplierId } });
  if (!supplier || supplier.role !== "SUPPLIER" || !supplier.active) {
    return NextResponse.json({ error: "Invalid supplier" }, { status: 400 });
  }

  const count = await prisma.job.count();
  const reference = `JOB-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  const job = await prisma.job.create({
    data: {
      reference,
      title,
      notes,
      createdById: viewer.id,
      supplierId,
    },
    include: jobInclude,
  });

  await prisma.notification.create({
    data: { userId: supplierId, jobId: job.id, type: "NEW_JOB" },
  });

  await sendNewJobEmail(supplier.email, supplier.name, reference).catch(() => {});

  return NextResponse.json(serializeJobForViewer(job, viewer), { status: 201 });
}
