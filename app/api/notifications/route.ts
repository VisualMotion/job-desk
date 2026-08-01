import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/access";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;

  const notifications = await prisma.notification.findMany({
    where: { userId: viewer.id },
    include: { job: { select: { reference: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(notifications);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;

  const { id } = await req.json();
  await prisma.notification.updateMany({
    where: { id, userId: viewer.id },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
