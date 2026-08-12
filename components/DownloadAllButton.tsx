"use client";

import { useState } from "react";

function splitPath(path: string): { folders: string[]; filename: string } {
  const parts = path.split("/");
  const filename = parts.pop()!;
  return { folders: parts, filename };
}

async function getOrCreateSubdir(
  root: FileSystemDirectoryHandle,
  folders: string[]
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const folder of folders) {
    dir = await dir.getDirectoryHandle(folder, { create: true });
  }
  return dir;
}

export default function DownloadAllButton({
  jobId,
  kind,
  fileCount,
}: {
  jobId: string;
  kind: "RAW" | "EDITED";
  reference: string;
  fileCount: number;
}) {
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supportsFolderPicker = typeof window !== "undefined" && "showDirectoryPicker" in window;

  async function handleClick() {
    setError(null);

    if (!supportsFolderPicker) {
      await downloadIndividually();
      return;
    }

    let dirHandle: FileSystemDirectoryHandle;
    try {
      dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    } catch {
      return;
    }

    setWorking(true);
    try {
      setProgress("Getting the file list…");
      const res = await fetch(`/api/jobs/${jobId}/download-all`, {
        method: "POST",
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) throw new Error("Couldn't get the file list for this job.");
      const { files } = await res.json();

      let firstError: string | null = null;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress(`Downloading ${i + 1} of ${files.length}…`);
        try {
          const { folders, filename } = splitPath(f.filename);
          const targetDir = await getOrCreateSubdir(dirHandle, folders);
          const fileHandle = await targetDir.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();

          const fileRes = await fetch(f.url);
          if (!fileRes.ok || !fileRes.body) throw new Error(`Couldn't fetch ${filename}`);

          await fileRes.body.pipeTo(writable);
        } catch (err: any) {
          console.error(`Failed on ${f.filename}:`, err);
          firstError = firstError ?? `Some files failed (starting with ${f.filename}). Check the console for details.`;
        }
      }
      if (firstError) setError(firstError);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setWorking(false);
      setProgress("");
    }
  }

  async function downloadIndividually() {
    setWorking(true);
    try {
      setProgress("Getting the file list…");
      const res = await fetch(`/api/jobs/${jobId}/download-all`, {
        method: "POST",
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) throw new Error("Couldn't get the file list for this job.");
      const { files } = await res.json();

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress(`Downloading ${i + 1} of ${files.length}…`);
        const a = document.createElement("a");
        a.href = f.url;
        a.download = f.filename.split("/").pop() || f.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setWorking(false);
      setProgress("");
    }
  }

  if (fileCount === 0) return null;

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={working}
        className="text-xs font-medium text-brass-deep hover:underline disabled:opacity-60"
      >
        {working
          ? progress || "Preparing…"
          : supportsFolderPicker
          ? `Download to folder (${fileCount})`
          : `Download all (${fileCount})`}
      </button>
      {error && <p className="text-xs text-rust mt-1">{error}</p>}
      {!supportsFolderPicker && !working && (
        <p className="text-[11px] text-ink-soft mt-1">
          Folder download needs Chrome or Edge - this browser will download files individually instead.
        </p>
      )}
    </div>
  );
}
