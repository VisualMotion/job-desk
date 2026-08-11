"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUploadQueue } from "./UploadQueueContext";

type Notif = {
  id: string;
  type: "NEW_JOB" | "JOB_COMPLETED";
  read: boolean;
  job: { reference: string; status: string };
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: "OWNER",
  SUPPLIER: "SUPPLIER",
  CONTRACTOR: "VM TEAM MEMBER",
};

export default function Navbar() {
  const { data: session } = useSession();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [uploadsOpen, setUploadsOpen] = useState(false);
  const { batches } = useUploadQueue();

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then(setNotifs)
      .catch(() => {});
  }, [session?.user]);

  const unread = notifs.filter((n) => !n.read).length;
  const role = (session?.user as any)?.role;
  const activeUploads = batches.filter((b) => !b.finishedAt);

  async function markRead(id: string) {
    await fetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ id }) });
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <header className="border-b border-line bg-paper-raised">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="bg-ink rounded px-2 py-1 flex items-center">
            <img src="/logo-full.png" alt="Visual Motion" className="h-5 w-auto" />
          </span>
          <span className="font-display font-bold text-ink">Job Desk</span>
        </Link>

        <div className="flex items-center gap-4">
          {role && (
            <span className="font-mono text-[10px] tracking-widest uppercase text-ink-soft border border-line rounded px-2 py-1">
              {ROLE_LABEL[role] ?? role}
            </span>
          )}

          {activeUploads.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setUploadsOpen((v) => !v)}
                className="flex items-center gap-1.5 text-sm text-brass-deep hover:text-brass px-2 py-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-pulse">
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Uploading {activeUploads.length > 1 ? `${activeUploads.length} jobs` : "1 job"}
              </button>
              {uploadsOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-paper-raised border border-line rounded-lg shadow-lg z-10">
                  {activeUploads.map((b) => (
                    <div key={b.id} className="px-4 py-3 border-b border-line last:border-0 text-sm">
                      <p className="font-mono text-xs text-brass-deep">{b.jobReference}</p>
                      <p className="text-ink-soft text-xs">
                        {b.kind === "RAW" ? "Raw photos" : "Edited photos"} — {b.done} of {b.total}
                      </p>
                    </div>
                  ))}
                  <p className="px-4 py-2 text-[11px] text-ink-soft border-t border-line">
                    Safe to keep working — these keep uploading in the background.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="relative text-sm text-ink-soft hover:text-ink px-2 py-1"
            >
              Notifications
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-rust text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-72 bg-paper-raised border border-line rounded-lg shadow-lg max-h-80 overflow-y-auto z-10">
                {notifs.length === 0 && (
                  <p className="p-4 text-sm text-ink-soft">Nothing yet.</p>
                )}
                {notifs.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full text-left px-4 py-3 border-b border-line last:border-0 text-sm hover:bg-paper ${
                      n.read ? "opacity-50" : ""
                    }`}
                  >
                    <p className="font-mono text-xs text-brass-deep">{n.job.reference}</p>
                    <p className="text-ink">
                      {n.type === "NEW_JOB" ? "New job ready to retrieve" : "Job completed"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {role === "OWNER" && (
            <Link href="/dashboard/admin/users" className="text-sm text-ink-soft hover:text-ink">
              Accounts
            </Link>
          )}

          {role === "OWNER" && (
            <Link href="/dashboard/admin/cleanup" className="text-sm text-ink-soft hover:text-ink">
              Cleanup
            </Link>
          )}

          <Link href="/dashboard/account" className="text-sm text-ink-soft hover:text-ink">
            Account
          </Link>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-ink-soft hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
