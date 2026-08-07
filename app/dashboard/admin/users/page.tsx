"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";

export default function UsersAdminPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;
  const [users, setUsers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userRole, setUserRole] = useState<"SUPPLIER" | "CONTRACTOR">("SUPPLIER");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  async function load() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => {
    if (role === "OWNER") load();
  }, [role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      body: JSON.stringify({ name, email, role: userRole, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error?.toString?.() ?? "Couldn't create the account.");
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    load();
  }

  async function toggleActive(id: string, name: string, currentlyActive: boolean) {
    if (!confirm(`${currentlyActive ? "Deactivate" : "Reactivate"} ${name}? ${currentlyActive ? "They won't be able to log in until reactivated." : "They'll be able to log in again."}`)) return;
    setTogglingId(id);
    setRowError(null);
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !currentlyActive }),
    });
    setTogglingId(null);
    load();
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Permanently delete ${name}? This can't be undone. This only works if they have no job history.`)) return;
    setDeletingId(id);
    setRowError(null);
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const body = await res.json();
      setRowError({ id, message: body.error ?? "Couldn't delete this account." });
      return;
    }
    load();
  }

  if (status === "loading") return null;
  if (role !== "OWNER") {
    return (
      <>
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12">
          <p className="text-ink-soft text-sm">This page is only available to the studio owner.</p>
        </main>
      </>
    );
  }

  const suppliers = users.filter((u) => u.role === "SUPPLIER");
  const contractors = users.filter((u) => u.role === "CONTRACTOR");

  function UserList({ list }: { list: any[] }) {
    return (
      <ul className="space-y-2">
        {list.map((u) => (
          <li key={u.id} className={`text-sm bg-paper-raised border border-line rounded-md px-3 py-2 ${!u.active ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-ink">
                  {u.name} {!u.active && <span className="text-[10px] font-medium text-rust border border-rust/30 rounded px-1.5 py-0.5 ml-1">Deactivated</span>}
                </p>
                <p className="text-ink-soft text-xs">{u.email}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => toggleActive(u.id, u.name, u.active)}
                  disabled={togglingId === u.id}
                  className={`text-xs font-medium hover:underline disabled:opacity-60 ${u.active ? "text-rust" : "text-moss"}`}
                >
                  {togglingId === u.id ? "…" : u.active ? "Deactivate" : "Reactivate"}
                </button>
                {!u.active && (
                  <button
                    onClick={() => deleteUser(u.id, u.name)}
                    disabled={deletingId === u.id}
                    className="text-xs font-medium text-rust hover:underline disabled:opacity-60"
                  >
                    {deletingId === u.id ? "…" : "Delete"}
                  </button>
                )}
              </div>
            </div>
            {rowError?.id === u.id && (
              <p className="text-xs text-rust mt-2 border-t border-line pt-2">{rowError.message}</p>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-ink mb-1">Accounts</h1>
        <p className="text-sm text-ink-soft mb-6">
          Suppliers and VM team members never see each other's accounts or contact details — this list is
          only visible to you. Deactivating blocks login immediately and keeps job history intact. Deleting
          is permanent and only available for deactivated accounts with no job history.
        </p>

        <form onSubmit={handleSubmit} className="bg-paper-raised border border-line rounded-lg p-5 space-y-4 mb-8">
          <h2 className="font-display font-semibold text-ink">Add an account</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
            />
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value as any)}
              className="rounded-md border border-line px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brass"
            >
              <option value="SUPPLIER">Supplier (editor)</option>
              <option value="CONTRACTOR">VM Team Member</option>
            </select>
            <input
              required
              type="password"
              placeholder="Temporary password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
            />
          </div>
          {error && <p className="text-sm text-rust">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-ink text-paper rounded-md px-4 py-2 text-sm font-medium hover:bg-ink-soft disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create account"}
          </button>
        </form>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-display font-semibold text-ink mb-2">Suppliers</h3>
            <UserList list={suppliers} />
          </div>
          <div>
            <h3 className="font-display font-semibold text-ink mb-2">VM Team Members</h3>
            <UserList list={contractors} />
          </div>
        </div>
      </main>
    </>
  );
}
