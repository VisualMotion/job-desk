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
  dueDate: z.string().optional(),
});

async function nextReference(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `JOB-${year}-`;
  const latest = await prisma.job.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const lastNum = latest ? parseInt(latest.reference.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;

  if (viewer.role !== "OWNER" && viewer.role !== "CONTRACTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, supplierId, notes, dueDate } = parsed.data;

  const supplier = await prisma.user.findUnique({ where: { id: supplierId } });
  if (!supplier || supplier.role !== "SUPPLIER" || !supplier.active) {
    return NextResponse.json({ error: "Invalid supplier" }, { status: 400 });
  }

  let job;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const reference = await nextReference();
      job = await prisma.job.create({
        data: {
          reference,
          title,
          notes,
          createdById: viewer.id,
          supplierId,
          dueDate: dueDate ? new Date(dueDate) : undefined,
        },
        include: jobInclude,
      });
      break;
    } catch (err: any) {
      lastErr = err;
      if (err?.code !== "P2002") throw err;
    }
  }
  if (!job) throw lastErr;

  await prisma.notification.create({
    data: { userId: supplierId, jobId: job.id, type: "NEW_JOB" },
  });

  await sendNewJobEmail(supplier.email, supplier.name, job.reference).catch(() => {});

  return NextResponse.json(serializeJobForViewer(job, viewer), { status: 201 });
}
