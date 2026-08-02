"use client";

import { useState, useRef } from "react";

const CONCURRENCY = 4;

export default function FileUploader({
  jobId,
  kind,
  onUploaded,
}: {
  jobId: string;
  kind: "RAW" | "EDITED";
  onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File) {
    const relativePath = (file as any).webkitRelativePath || file.name;

    const presignRes = await fetch("/api/upload-url", {
      method: "POST",
      body: JSON.stringify({
        jobId,
        kind,
        filename: relativePath,
        contentType: file.type || "application/octet-stream",
      }),
    });
    if (!presignRes.ok) {
      throw new Error(`Couldn't get an upload link for ${relativePath} (status ${presignRes.status}).`);
    }
    const { uploadUrl, key } = await presignRes.json();

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
    if (!putRes.ok) {
      throw new Error(
        `Storage rejected ${relativePath} (status ${putRes.status}). This is usually a CORS setting on the bucket.`
      );
    }

    const registerRes = await fetch(`/api/jobs/${jobId}/files`, {
      method: "POST",
      body: JSON.stringify({
        kind,
        filename: relativePath,
        storageKey: key,
        sizeBytes: file.size,
        contentType: file.type,
      }),
    });
    if (!registerRes.ok) {
      throw new Error(`${relativePath} uploaded but couldn't be saved to the job record.`);
    }
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).filter((f) => !f.name.startsWith("."));
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    setDone(0);
    setTotal(files.length);

    let firstError: string | null = null;
    let cursor = 0;

    async function worker() {
      while (cursor < files.length) {
        const index = cursor++;
        try {
          await uploadOne(files[index]);
        } catch (err: any) {
          firstError = firstError ?? (err?.message ?? "Something went wrong during upload.");
        } finally {
          setDone((d) => d + 1);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));

    setUploading(false);
    if (filesInputRef.current) filesInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";

    if (firstError) {
      setError(firstError);
    } else {
      onUploaded();
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center bg-ink text-paper rounded-md px-3 py-2 text-sm font-medium hover:bg-ink-soft cursor-pointer">
          Select folder
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore - non-standard but supported attributes for folder selection
            webkitdirectory=""
            directory=""
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading}
            className="hidden"
          />
        </label>

        <label className="inline-flex items-center border border-line text-ink rounded-md px-3 py-2 text-sm font-medium hover:bg-paper cursor-pointer">
          Select files
          <input
            ref={filesInputRef}
            type="file"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {uploading && (
        <p className="text-xs text-ink-soft mt-2">
          Uploading {done} of {total}…
        </p>
      )}
      {error && <p className="text-xs text-rust mt-2">{error}</p>}
    </div>
  );
}