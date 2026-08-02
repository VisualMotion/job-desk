"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function CleanupPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;

  const [cutoffDate, setCutoffDate] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function runPreview() {
    if (!cutoffDate) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/admin/bulk-delete-raw", {
      method: "POST",
      body: JSON.stringify({ cutoffDate, dryRun: true }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Something went wrong checking what would be deleted.");
      return;
    }
    setPreview(await res.json());
  }

  async function confirmDelete() {
    if (!preview) return;
    const sure = confirm(
      `This will permanently delete ${preview.filesToDelete} raw file(s) across ${preview.jobsAffected} completed job(s), freeing approximately ${formatBytes(preview.approxBytesFreed)}. This cannot be undone. Continue?`
    );
    if (!sure) return;

    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/bulk-delete-raw", {
      method: "POST",
      body: JSON.stringify({ cutoffDate, dryRun: false }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Something went wrong during deletion.");
      return;
    }
    setResult(await res.json());
    setPreview(null);
  }

  if (status === "loading") return null;
  if (role !== "OWNER") {
    return (
      <>
        <Navbar />
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-12">
          <p className="text-ink-soft text-sm">This page is only available to the studio owner.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-ink mb-1">Monthly cleanup</h1>
        <p className="text-sm text-ink-soft mb-6">
          Permanently delete raw photos from completed jobs to keep storage costs down. Edited/final
          photos are never touched by this — only raw source files on jobs that are already finished.
        </p>

        <div className="bg-paper-raised border border-line rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1">
              Delete raw files from jobs completed on or before
            </label>
            <input
              type="date"
              value={cutoffDate}
              onChange={(e) => {
                setCutoffDate(e.target.value);
                setPreview(null);
                setResult(null);
              }}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
            />
          </div>

          <button
            onClick={runPreview}
            disabled={!cutoffDate || loading}
            className="border border-line text-ink rounded-md px-4 py-2 text-sm font-medium hover:bg-paper disabled:opacity-60"
          >
            {loading && !preview ? "Checking…" : "Preview what would be deleted"}
          </button>

          {error && <p className="text-sm text-rust">{error}</p>}

          {preview && (
            <div className="border border-brass/30 bg-brass/5 rounded-lg p-4">
              <p className="text-sm text-ink">
                This would delete <strong>{preview.filesToDelete} raw file(s)</strong> across{" "}
                <strong>{preview.jobsAffected} completed job(s)</strong>, freeing approximately{" "}
                <strong>{formatBytes(preview.approxBytesFreed)}</strong>.
              </p>
              {preview.filesToDelete > 0 ? (
                <button
                  onClick={confirmDelete}
                  disabled={loading}
                  className="mt-3 bg-rust text-white rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? "Deleting…" : "Permanently delete these files"}
                </button>
              ) : (
                <p className="text-sm text-ink-soft mt-2">Nothing to delete for this date range.</p>
              )}
            </div>
          )}

          {result && (
            <div className="border border-moss/30 bg-moss/5 rounded-lg p-4">
              <p className="text-sm text-ink">
                Done. Deleted <strong>{result.filesDeleted} raw file(s)</strong> across{" "}
                <strong>{result.jobsAffected} job(s)</strong>, freeing approximately{" "}
                <strong>{formatBytes(result.approxBytesFreed)}</strong>.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
