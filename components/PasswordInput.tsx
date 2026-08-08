"use client";

import { useState, InputHTMLAttributes } from "react";

export default function PasswordInput(
  props: InputHTMLAttributes<HTMLInputElement> & { className?: string }
) {
  const [visible, setVisible] = useState(false);
  const { className, ...rest } = props;

  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className={`${className ?? ""} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.4A9.9 9.9 0 0112 5c5 0 9 4.5 10 7-.5 1.2-1.3 2.5-2.4 3.6M6.5 6.7C4.6 8 3.2 9.8 2 12c1 2.5 5 7 10 7 1.3 0 2.5-.3 3.6-.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
