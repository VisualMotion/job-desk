"use client";

import { useEffect, useMemo, useState } from "react";
import JobTicket from "./JobTicket";

function dayKey(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-CA");
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";

  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "UPLOADED", label: "Waiting" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
];

export default function JobList() {
  const [jobs, setJobs] = useState<any[] | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");

  async function load() {
    const res = await fetch("/api/jobs");
    setJobs(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (status !== "ALL" && job.status !== status) return false;
      if (!q) return true;
      const haystack = [
        job.reference,
        job.title,
        job.createdBy?.name,
        job.supplier?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [jobs, query, status]);

  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const job of filtered) {
      const key = dayKey(job.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(job);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by reference, title, or name…"
          className="flex-1 min-w-[200px] rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass bg-paper-raised"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-line px-3 py-2 text-sm bg-paper-raised focus:outline-none focus:ring-2 focus:ring-brass"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {groups.length === 0 && (
        <div className="border border-dashed border-line rounded-lg p-8 text-center">
          <p className="text-ink-soft text-sm">No jobs match that search.</p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map(([key, dayJobs]) => {
          const isCollapsed = collapsed.has(key);
          return (
            <div key={key}>
              <button
                onClick={() => toggle(key)}
                className="w-full flex items-center gap-2 mb-2 group"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={`text-ink-soft transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-display font-semibold text-ink text-sm">
                  {dayLabel(dayJobs[0].createdAt)}
                </span>
                <span className="font-mono text-xs text-ink-soft">
                  {dayJobs.length} job{dayJobs.length === 1 ? "" : "s"}
                </span>
                <span className="flex-1 border-t border-dashed border-line ml-2" />
              </button>

              {!isCollapsed && (
                <div className="space-y-3 pl-5 border-l-2 border-line ml-1.5">
                  {dayJobs.map((job) => (
                    <JobTicket key={job.id} job={job} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}