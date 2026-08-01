"use client";

import { useEffect, useState } from "react";
import JobTicket from "./JobTicket";

export default function JobList() {
  const [jobs, setJobs] = useState<any[] | null>(null);

  async function load() {
    const res = await fetch("/api/jobs");
    setJobs(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  if (jobs === null) {
    return <p className="text-sm text-ink-soft">Loading jobs…</p>;
  }

  if (jobs.length === 0) {
    return (
      <div className="border border-dashed border-line rounded-lg p-8 text-center">
        <p className="text-ink-soft text-sm">No jobs yet. Once one is created, it'll show up here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobTicket key={job.id} job={job} />
      ))}
    </div>
  );
}
