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
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

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
      if (!presignRes.ok) continue;
      const { uploadUrl, key } = await presignRes.json();

      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      await fetch(`/api/jobs/${jobId}/files`, {
        method: "POST",
        body: JSON.stringify({
          kind,
          filename: file.name,
          storageKey: key,
          sizeBytes: file.size,
          contentType: file.type,
        }),
      });
    }

    setUploading(false);
    setProgress("");
    if (inputRef.current) inputRef.current.value = "";
    onUploaded();
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
    </div>
  );
}
