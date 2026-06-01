import { type ReactNode } from "react";
import { TopShell } from "@/components/TopShell";

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <TopShell>{children}</TopShell>;
}
