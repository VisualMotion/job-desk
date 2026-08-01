"use client";

import { useState } from "react";
import JSZip from "jszip";

export default function DownloadAllButton({
  jobId,
  kind,
  reference,
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

  async function handleClick() {
    setWorking(true);
    setError(null);
    try {
      setProgress("Getting download links…");
      const res = await fetch(`/api/jobs/${jobId}/download-all`, {
        method: "POST",
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) throw new Error("Couldn't get download links for this job.");
      const { files } = await res.json();

      const zip = new JSZip();
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress(`Downloading ${i + 1} of ${files.length}…`);
        const fileRes = await fetch(f.url);
        if (!fileRes.ok) throw new Error(`Couldn't download ${f.filename}.`);
        const blob = await fileRes.blob();
        zip.file(f.filename, blob);
      }

      setProgress("Zipping up…");
      const zipBlob = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reference}-${kind.toLowerCase()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong building the zip.");
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
        {working ? progress || "Preparing…" : `Download all as ZIP (${fileCount})`}
      </button>
      {error && <p className="text-xs text-rust mt-1">{error}</p>}
    </div>
  );
}