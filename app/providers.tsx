"use client";

import { SessionProvider } from "next-auth/react";
import { UploadQueueProvider } from "@/components/UploadQueueContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <UploadQueueProvider>{children}</UploadQueueProvider>
    </SessionProvider>
  );
}
