"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type UploadBatch = {
  id: string;
  jobId: string;
  jobReference: string;
  kind: "RAW" | "EDITED";
  total: number;
  done: number;
  error: string | null;
  finishedAt: number | null;
};

type UploadQueueContextValue = {
  batches: UploadBatch[];
  startUpload: (jobId: string, jobReference: string, kind: "RAW" | "EDITED", files: FileList) => string;
};

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

const CONCURRENCY = 4;

async function uploadOne(jobId: string, kind: "RAW" | "EDITED", file: File) {
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
    throw new Error(`Storage rejected ${relativePath} (status ${putRes.status}).`);
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

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const nextId = useRef(0);

  function updateBatch(id: string, patch: Partial<UploadBatch>) {
    setBatches((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  const startUpload = useCallback(
    (jobId: string, jobReference: string, kind: "RAW" | "EDITED", fileList: FileList) => {
      const files = Array.from(fileList).filter((f) => !f.name.startsWith("."));
      const id = `upload-${nextId.current++}`;

      const batch: UploadBatch = {
        id,
        jobId,
        jobReference,
        kind,
        total: files.length,
        done: 0,
        error: null,
        finishedAt: null,
      };
      setBatches((prev) => [...prev, batch]);

      (async () => {
        let firstError: string | null = null;
        let cursor = 0;

        async function worker() {
          while (cursor < files.length) {
            const index = cursor++;
            try {
              await uploadOne(jobId, kind, files[index]);
            } catch (err: any) {
              firstError = firstError ?? (err?.message ?? "Something went wrong during upload.");
            } finally {
              setBatches((prev) =>
                prev.map((b) => (b.id === id ? { ...b, done: b.done + 1 } : b))
              );
            }
          }
        }

        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));

        updateBatch(id, { error: firstError, finishedAt: Date.now() });

        if (kind === "RAW" && !firstError) {
          fetch(`/api/jobs/${jobId}/notify-supplier`, { method: "POST" }).catch(() => {});
        }

        setTimeout(() => {
          setBatches((prev) => prev.filter((b) => b.id !== id));
        }, 8000);
      })();

      return id;
    },
    []
  );

  return (
    <UploadQueueContext.Provider value={{ batches, startUpload }}>
      {children}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue() {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) throw new Error("useUploadQueue must be used within UploadQueueProvider");
  return ctx;
}
