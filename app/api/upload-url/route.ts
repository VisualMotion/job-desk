import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/access";
import { buildStorageKey, getUploadUrl } from "@/lib/storage";
import { z } from "zod";

const schema = z.object({
  jobId: z.string(),
  kind: z.enum(["RAW", "EDITED"]),
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = session.user as unknown as SessionUser;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { jobId, kind, filename, contentType } = parsed.data;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // RAW files: only the job's creator (owner or contractor) may add source photos.
  // EDITED files: only the assigned supplier may add finished edits.
  const allowed =
    (kind === "RAW" && (job.createdById === viewer.id || viewer.role === "OWNER")) ||
    (kind === "EDITED" && job.supplierId === viewer.id);

  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const key = buildStorageKey(jobId, kind.toLowerCase() as "raw" | "edited", filename);
  const uploadUrl = await getUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key });
}
