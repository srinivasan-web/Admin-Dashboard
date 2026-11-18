import type { ReactNode } from "react";
import { Toaster } from "../components/ui/Toast";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="top-right" />
    </>
  );
}
