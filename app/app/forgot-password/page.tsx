"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-brass" />
            <span className="font-mono text-xs tracking-widest text-ink-soft uppercase">Job Desk</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">Reset your password</h1>
        </div>

        {sent ? (
          <div className="bg-paper-raised border border-line rounded-lg p-6 text-center">
            <p className="text-sm text-ink">
              If an account exists for that email, a reset link is on its way. Check your inbox
              (and spam folder) — the link expires in an hour.
            </p>
            <Link href="/login" className="inline-block mt-4 text-sm text-brass-deep hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-paper-raised border border-line rounded-lg p-6 space-y-4 shadow-sm">
            <p className="text-sm text-ink-soft">
              Enter your email and we'll send you a link to choose a new password.
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-paper rounded-md py-2 text-sm font-medium hover:bg-ink-soft transition-colors disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset link"}
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