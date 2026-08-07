import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/access";
import bcrypt from "bcryptjs";
import { z } from "zod";

// List users of a given role. Owner can list anyone. Contractors/suppliers can only
// list SUPPLIER accounts (needed to populate the "assign to" dropdown when creating
// a job) - never CONTRACTOR accounts, which would leak who else works for the business.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;

  const url = new URL(req.url);
  const roleParam = url.searchParams.get("role");

  if (viewer.role !== "OWNER") {
    if (roleParam !== "SUPPLIER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const users = await prisma.user.findMany({
    where: {
      role: (roleParam as any) || undefined,
      active: viewer.role === "OWNER" ? undefined : true,
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["SUPPLIER", "CONTRACTOR", "OWNER"]),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;
  if (viewer.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createUserSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { name, email, role, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), role, passwordHash },
  });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role }, { status: 201 });
}
