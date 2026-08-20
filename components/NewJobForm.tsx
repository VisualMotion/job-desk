"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewJobForm() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users?role=SUPPLIER")
      .then((r) => r.json())
      .then(setSuppliers)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        body: JSON.stringify({ title, supplierId, notes, dueDate: dueDate || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          typeof body.error === "string"
            ? body.error
            : `Couldn't create the job (status ${res.status}).`
        );
        return;
      }
      const job = await res.json();
      router.push(`/dashboard/jobs/${job.id}`);
    } catch (err: any) {
      console.error("Job creation failed:", err);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-ink text-paper rounded-md px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors"
      >
        + New job
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-paper-raised border border-line rounded-lg p-5 space-y-4 mb-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-ink">New job</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-soft">
          Cancel
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-soft mb-1">
          Title (property / shoot reference)
        </label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 42 Marina Ave — twilight exteriors"
          className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-soft mb-1">Assign to supplier</label>
        <select
          required
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass bg-white"
        >
          <option value="">Select a supplier…</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {suppliers.length === 0 && (
          <p className="text-xs text-rust mt-1">
            No suppliers found. Add one under Accounts before creating a job.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-soft mb-1">Due date (optional)</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-soft mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Editing instructions…"
          className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
        />
      </div>

      {error && <p className="text-sm text-rust">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-ink text-paper rounded-md px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors disabled:opacity-60"
      >
        {submitting ? "Creating…" : "Create job — then add photos"}
      </button>
    </form>
  );
}
