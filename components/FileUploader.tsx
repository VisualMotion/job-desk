"use client";

import { useState, useRef } from "react";

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
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);

        const presignRes = await fetch("/api/upload-url", {
          method: "POST",
          body: JSON.stringify({
            jobId,
            kind,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
          }),
        });
        if (!presignRes.ok) {
          throw new Error(`Couldn't get an upload link for ${file.name} (server said: ${presignRes.status}).`);
        }
        const { uploadUrl, key } = await presignRes.json();

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!putRes.ok) {
          throw new Error(
            `Storage rejected ${file.name} (status ${putRes.status}). This is usually a CORS setting on the bucket.`
          );
        }

        const registerRes = await fetch(`/api/jobs/${jobId}/files`, {
          method: "POST",
          body: JSON.stringify({
            kind,
            filename: file.name,
            storageKey: key,
            sizeBytes: file.size,
            contentType: file.type,
          }),
        });
        if (!registerRes.ok) {
          throw new Error(`${file.name} uploaded but couldn't be saved to the job record.`);
        }
      }
      onUploaded();
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Something went wrong during upload.");
    } finally {
      setUploading(false);
      setProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading}
        className="block w-full text-sm text-ink-soft file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-ink file:text-paper file:text-sm file:font-medium hover:file:bg-ink-soft file:cursor-pointer disabled:opacity-60"
      />
      {uploading && <p className="text-xs text-ink-soft mt-2">{progress}</p>}
      {error && <p className="text-xs text-rust mt-2">{error}</p>}
    </div>
  );
}