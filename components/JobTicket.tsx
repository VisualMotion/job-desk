import Link from "next/link";

const STATUS_STYLE: Record<string, string> = {
  UPLOADED: "bg-slate/10 text-slate",
  IN_PROGRESS: "bg-brass/10 text-brass-deep",
  COMPLETED: "bg-moss/10 text-moss",
};

const STATUS_LABEL: Record<string, string> = {
  UPLOADED: "Waiting",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export default function JobTicket({ job }: { job: any }) {
  return (
    <Link
      href={`/dashboard/jobs/${job.id}`}
      className="ticket-notch flex items-stretch bg-paper-raised border border-line rounded-lg overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-xs text-brass-deep tracking-wide">{job.reference}</span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[job.status]}`}>
            {STATUS_LABEL[job.status]}
          </span>
        </div>
        <p className="font-display font-medium text-ink">
          {job.title ?? "Editing job"}
        </p>
        <p className="text-xs text-ink-soft mt-1">
          {job.createdBy ? `From ${job.createdBy.name}` : ""}
          {job.createdBy && job.supplier ? " · " : ""}
          {job.supplier ? `To ${job.supplier.name}` : ""}
          {!job.createdBy && !job.supplier ? "\u00A0" : ""}
        </p>
      </div>
      <div className="w-px border-l border-dashed border-line" />
      <div className="w-16 flex items-center justify-center text-ink-soft font-mono text-xs">
        {job.files?.length ?? 0} file{(job.files?.length ?? 0) === 1 ? "" : "s"}
      </div>
    </Link>
  );
}
