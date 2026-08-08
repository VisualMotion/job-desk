"use client";

import { useState, FormEvent } from "react";
import Navbar from "@/components/Navbar";
import PasswordInput from "@/components/PasswordInput";

export default function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/account/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Something went wrong.");
      return;
    }
    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-ink mb-6">Account settings</h1>

        <form onSubmit={handleSubmit} className="bg-paper-raised border border-line rounded-lg p-5 space-y-4">
          <h2 className="font-display font-semibold text-ink">Change password</h2>
          <PasswordInput
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
          />
          <PasswordInput
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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
          {success && <p className="text-sm text-moss">Password updated.</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-ink text-paper rounded-md px-4 py-2 text-sm font-medium hover:bg-ink-soft disabled:opacity-60"
          >
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      </main>
    </>
  );
}
