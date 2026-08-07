import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "portal@example.com";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owners = await prisma.user.findMany({ where: { role: "OWNER", active: true } });
  if (owners.length === 0) return NextResponse.json({ ok: true, note: "No owners to notify." });

  const eligibleJobs = await prisma.job.findMany({
    where: { status: "COMPLETED" },
    select: { id: true },
  });
  const files = await prisma.jobFile.findMany({
    where: { jobId: { in: eligibleJobs.map((j) => j.id) }, kind: "RAW" },
    select: { sizeBytes: true },
  });
  const totalBytes = files.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);
  const gb = (totalBytes / 1024 / 1024 / 1024).toFixed(1);

  if (resend && files.length > 0) {
    await Promise.all(
      owners.map((owner) =>
        resend.emails.send({
          from: FROM,
          to: owner.email,
          subject: `Cleanup reminder — ${files.length} raw files ready to clear`,
          html: `
            <p>Hi ${owner.name},</p>
            <p>Time for your regular cleanup. There ${files.length === 1 ? "is" : "are"} currently
            <strong>${files.length} raw file(s)</strong> (~${gb} GB) sitting on completed jobs.</p>
            <p><a href="${APP_URL}/dashboard/admin/cleanup">Open the Cleanup tool</a> to review and delete them.</p>
          `,
        })
      )
    );
  }

  return NextResponse.json({ ok: true, filesEligible: files.length, approxGB: gb });
}