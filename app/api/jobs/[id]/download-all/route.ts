import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jobScopeFor, SessionUser } from "@/lib/access";
import { getDownloadUrl } from "@/lib/storage";
import { z } from "zod";

const schema = z.object({ kind: z.enum(["RAW", "EDITED"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;
  const { id: jobId } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const job = await prisma.job.findFirst({ where: { id: jobId, ...jobScopeFor(viewer) } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const files = await prisma.jobFile.findMany({
    where: { jobId, kind: parsed.data.kind },
    orderBy: { filename: "asc" },
  });

  const links = await Promise.all(
    files.map(async (f) => ({
      filename: f.filename,
      url: await getDownloadUrl(f.storageKey),
    }))
  );

  return NextResponse.json({ reference: job.reference, files: links });
}