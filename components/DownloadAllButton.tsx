"use client";

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
  if (fileCount === 0) return null;

  return (
    
      href={`/api/jobs/${jobId}/download-zip?kind=${kind}`}
      className="text-xs font-medium text-brass-deep hover:underline"
    >
      Download all as ZIP ({fileCount})
    </a>
  );
}
