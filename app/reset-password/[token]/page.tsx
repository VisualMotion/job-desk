"use client";

import { useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword: password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-brass" />
            <span className="font-mono text-xs tracking-widest text-ink-soft uppercase">Job Desk</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">Choose a new password</h1>
        </div>

        {done ? (
          <div className="bg-paper-raised border border-line rounded-lg p-6 text-center">
            <p className="text-sm text-ink">Password updated. Taking you to sign in…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-paper-raised border border-line rounded-lg p-6 space-y-4 shadow-sm">
            <PasswordInput
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min. 8 characters)"
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
            />
            <PasswordInput
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
            />
            {error && <p className="text-sm text-rust">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-paper rounded-md py-2 text-sm font-medium hover:bg-ink-soft transition-colors disabled:opacity-60"
            >
              {loading ? "Saving…" : "Save new password"}
            </button>
            <Link href="/login" className="block text-center text-sm text-ink-soft hover:text-ink">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
