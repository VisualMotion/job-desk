import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/access";
import { sendJobCompletedEmail } from "@/lib/email";
import { z } from "zod";

const schema = z.object({ status: z.enum(["IN_PROGRESS", "COMPLETED"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;
  const { id } = await params;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const job = await prisma.job.findFirst({
    where: { id, supplierId: viewer.role === "SUPPLIER" ? viewer.id : "__none__" },
    include: { createdBy: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.job.update({
    where: { id },
    data: {
      status: parsed.data.status,
      completedAt: parsed.data.status === "COMPLETED" ? new Date() : null,
    },
  });

  if (parsed.data.status === "COMPLETED") {
    const recipients = new Set<string>();

    const owners = await prisma.user.findMany({ where: { role: "OWNER", active: true } });
    for (const owner of owners) recipients.add(owner.id);

    if (job.createdBy && job.createdBy.role === "CONTRACTOR") {
      recipients.add(job.createdBy.id);
    }

    await prisma.notification.createMany({
      data: Array.from(recipients).map((userId) => ({
        userId,
        jobId: job.id,
        type: "JOB_COMPLETED" as const,
      })),
    });

    const recipientUsers = await prisma.user.findMany({ where: { id: { in: Array.from(recipients) } } });
    await Promise.all(
      recipientUsers.map((u) => sendJobCompletedEmail(u.email, u.name, job.reference).catch(() => {}))
    );
  }

  return NextResponse.json({ id: updated.id, status: updated.status });
}
