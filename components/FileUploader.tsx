"use client";

import { useEffect, useRef, useState } from "react";
import { useUploadQueue } from "./UploadQueueContext";

export default function FileUploader({
  jobId,
  jobReference,
  kind,
  onUploaded,
}: {
  jobId: string;
  jobReference: string;
  kind: "RAW" | "EDITED";
  onUploaded: () => void;
}) {
  const { batches, startUpload } = useUploadQueue();
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (trackedId) return;
    const existing = batches.find((b) => b.jobId === jobId && b.kind === kind && !b.finishedAt);
    if (existing) setTrackedId(existing.id);
  }, [batches, jobId, kind, trackedId]);

  const current = batches.find((b) => b.id === trackedId);

  useEffect(() => {
    if (current?.finishedAt && !notifiedRef.current) {
      notifiedRef.current = true;
      onUploaded();
    }
  }, [current?.finishedAt, onUploaded]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    notifiedRef.current = false;
    const id = startUpload(jobId, jobReference, kind, fileList);
    setTrackedId(id);
    if (filesInputRef.current) filesInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  const uploading = !!current && !current.finishedAt;

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

      {current && (
        <p className="text-xs text-ink-soft mt-2">
          {current.finishedAt
            ? current.error
              ? `Finished with an error: ${current.error}`
              : `Uploaded ${current.total} file${current.total === 1 ? "" : "s"}.`
            : `Uploading ${current.done} of ${current.total}… (safe to switch jobs, this keeps going)`}
        </p>
      )}
    </div>
  );
}
