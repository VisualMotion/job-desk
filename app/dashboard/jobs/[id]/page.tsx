"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import FileUploader from "@/components/FileUploader";
import DownloadAllButton from "@/components/DownloadAllButton";

const STATUS_LABEL: Record<string, string> = {
  UPLOADED: "Waiting for supplier",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [job, setJob] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState<"RAW" | "EDITED" | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    setJob(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function download(fileId: string, filename: string) {
    const res = await fetch("/api/download-url", {
      method: "POST",
      body: JSON.stringify({ fileId }),
    });
    if (!res.ok) return;
    const { url } = await res.json();
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  async function deleteFile(fileId: string, filename: string) {
    if (!confirm(`Delete "${filename}"? This can't be undone.`)) return;
    setDeletingId(fileId);
    await fetch(`/api/jobs/${id}/files/${fileId}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  }

  async function deleteAll(kind: "RAW" | "EDITED", count: number) {
    if (!confirm(`Delete all ${count} file(s) in this folder? This can't be undone.`)) return;
    setDeletingAll(kind);
    await fetch(`/api/jobs/${id}/files`, {
      method: "DELETE",
      body: JSON.stringify({ kind }),
    });
    setDeletingAll(null);
    load();
  }
    async function afterRawUpload() {
    await fetch(`/api/jobs/${id}/notify-supplier`, { method: "POST" });
    load();
  }
  async function markComplete() {
    setUpdating(true);
    await fetch(`/api/jobs/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    setUpdating(false);
    load();
  }

  if (notFound) {
    return (
      <>
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12 text-center">
          <p className="text-ink-soft">
            This job doesn't exist, or isn't visible to your account.
          </p>
          <button onClick={() => router.push("/dashboard")} className="mt-4 text-sm text-brass-deep">
            Back to jobs
          </button>
        </main>
      </>
    );
  }

  if (!job) {
    return (
      <>
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12">
          <p className="text-ink-soft text-sm">Loading…</p>
        </main>
      </>
    );
  }

  const rawFiles = job.files.filter((f: any) => f.kind === "RAW");
  const editedFiles = job.files.filter((f: any) => f.kind === "EDITED");

  const canUploadRaw = (role === "OWNER" || role === "CONTRACTOR") && job.status !== "COMPLETED";
  const canManageRaw = role === "OWNER" || role === "CONTRACTOR";
  const canUploadEdited = role === "SUPPLIER" && job.status !== "COMPLETED";
  const canManageEdited = role === "OWNER" || role === "SUPPLIER";

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <button onClick={() => router.push("/dashboard")} className="text-sm text-ink-soft mb-4">
          ← Back to jobs
        </button>

        <div className="bg-paper-raised border border-line rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-xs text-brass-deep tracking-wide mb-1">{job.reference}</p>
              <h1 className="font-display text-xl font-bold text-ink">
                {job.title ?? "Editing job"}
              </h1>
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-brass/10 text-brass-deep">
              {STATUS_LABEL[job.status]}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {job.createdBy && (
              <div>
                <dt className="text-ink-soft text-xs">Submitted by</dt>
                <dd className="text-ink">{job.createdBy.name}</dd>
              </div>
            )}
            {job.supplier && (
              <div>
                <dt className="text-ink-soft text-xs">Editing supplier</dt>
                <dd className="text-ink">{job.supplier.name}</dd>
              </div>
            )}
          </dl>

          {job.notes && (
            <p className="mt-4 text-sm text-ink-soft border-t border-line pt-4">{job.notes}</p>
          )}
        </div>

        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display font-semibold text-ink">Raw photos</h2>
            <div className="flex items-center gap-3">
              <DownloadAllButton jobId={job.id} kind="RAW" reference={job.reference} fileCount={rawFiles.length} />
              {canManageRaw && rawFiles.length > 0 && (
                <button
                  onClick={() => deleteAll("RAW", rawFiles.length)}
                  disabled={deletingAll === "RAW"}
                  className="text-xs font-medium text-rust hover:underline disabled:opacity-60"
                >
                  {deletingAll === "RAW" ? "Deleting…" : "Delete all"}
                </button>
              )}
            </div>
          </div>
          <FileList
            files={rawFiles}
            onDownload={download}
            onDelete={canManageRaw ? deleteFile : undefined}
            deletingId={deletingId}
          />
          {canUploadRaw && (
            <div className="mt-3">
              <<FileUploader jobId={job.id} kind="RAW" onUploaded={afterRawUpload} />
            </div>
          )}
        </section>

        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display font-semibold text-ink">Edited photos</h2>
            <div className="flex items-center gap-3">
              <DownloadAllButton jobId={job.id} kind="EDITED" reference={job.reference} fileCount={editedFiles.length} />
              {canManageEdited && editedFiles.length > 0 && (
                <button
                  onClick={() => deleteAll("EDITED", editedFiles.length)}
                  disabled={deletingAll === "EDITED"}
                  className="text-xs font-medium text-rust hover:underline disabled:opacity-60"
                >
                  {deletingAll === "EDITED" ? "Deleting…" : "Delete all"}
                </button>
              )}
            </div>
          </div>
          <FileList
            files={editedFiles}
            onDownload={download}
            onDelete={canManageEdited ? deleteFile : undefined}
            deletingId={deletingId}
          />
          {canUploadEdited && (
            <div className="mt-3">
              <FileUploader jobId={job.id} kind="EDITED" onUploaded={load} />
            </div>
          )}
        </section>

        {role === "SUPPLIER" && job.status !== "COMPLETED" && editedFiles.length > 0 && (
          <button
            onClick={markComplete}
            disabled={updating}
            className="bg-moss text-white rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {updating ? "Marking complete…" : "Mark job complete"}
          </button>
        )}
      </main>
    </>
  );
}

// Files uploaded via "Select folder" carry their folder path in the filename
// (e.g. "Bracketed-Exteriors/IMG_001.jpg"). Group those by top-level folder so a
// 150-photo shoot shows as one row, not 150. Files with no "/" (picked individually)
// show as their own row as before.
function groupFiles(files: any[]) {
  const folders = new Map<string, any[]>();
  const loose: any[] = [];

  for (const f of files) {
    const slash = f.filename.indexOf("/");
    if (slash === -1) {
      loose.push(f);
    } else {
      const folderName = f.filename.slice(0, slash);
      if (!folders.has(folderName)) folders.set(folderName, []);
      folders.get(folderName)!.push(f);
    }
  }

  return { folders, loose };
}

function FileList({
  files,
  onDownload,
  onDelete,
  deletingId,
}: {
  files: any[];
  onDownload: (id: string, name: string) => void;
  onDelete?: (id: string, name: string) => void;
  deletingId: string | null;
}) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  if (files.length === 0) {
    return <p className="text-sm text-ink-soft italic">None yet.</p>;
  }

  const { folders, loose } = groupFiles(files);

  function toggleFolder(name: string) {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <ul className="divide-y divide-line border border-line rounded-lg bg-paper-raised">
      {Array.from(folders.entries()).map(([folderName, folderFiles]) => {
        const isOpen = openFolders.has(folderName);
        return (
          <li key={folderName}>
            <button
              onClick={() => toggleFolder(folderName)}
              className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-paper"
            >
              <span className="flex items-center gap-2 text-ink truncate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-brass-deep shrink-0">
                  <path
                    d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
                    fill="currentColor"
                    opacity="0.15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                {folderName}
              </span>
              <span className="font-mono text-xs text-ink-soft shrink-0 ml-3">
                {folderFiles.length} file{folderFiles.length === 1 ? "" : "s"} {isOpen ? "▲" : "▼"}
              </span>
            </button>
            {isOpen && (
              <ul className="divide-y divide-line bg-paper">
                {folderFiles.map((f) => (
                  <li key={f.id} className="flex items-center justify-between pl-9 pr-4 py-1.5 text-xs">
                    <span className="text-ink truncate">{f.filename.slice(folderName.length + 1)}</span>
                    <span className="flex items-center gap-3 shrink-0 ml-3">
                      <button onClick={() => onDownload(f.id, f.filename)} className="text-brass-deep hover:underline">
                        Download
                      </button>
                      {onDelete && (
                        <button
                          onClick={() => onDelete(f.id, f.filename)}
                          disabled={deletingId === f.id}
                          className="text-rust hover:underline disabled:opacity-60"
                        >
                          {deletingId === f.id ? "Deleting…" : "Delete"}
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}

      {loose.map((f) => (
        <li key={f.id} className="flex items-center justify-between px-4 py-2 text-sm">
          <span className="text-ink truncate">{f.filename}</span>
          <span className="flex items-center gap-3 shrink-0 ml-3">
            <button onClick={() => onDownload(f.id, f.filename)} className="text-brass-deep hover:underline text-xs">
              Download
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(f.id, f.filename)}
                disabled={deletingId === f.id}
                className="text-rust hover:underline text-xs disabled:opacity-60"
              >
                {deletingId === f.id ? "Deleting…" : "Delete"}
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}