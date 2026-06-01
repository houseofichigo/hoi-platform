import type { ReactNode } from "react";
import logoNavy from "@/assets/logos/logo-navy-mark.png";

interface AuthCardProps {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
}

export function AuthCard({ eyebrow, title, subtitle, children }: AuthCardProps) {
  return (
    <div className="relative min-h-screen bg-paper">
      <div className="absolute left-6 top-6 flex items-center gap-2">
        <img src={logoNavy} alt="House of Ichigo" className="h-6 w-6" />
        <span className="text-[13px] font-medium text-navy">House of Ichigo</span>
      </div>

      <div className="flex min-h-screen items-center justify-center px-4 py-24">
        <div className="w-full max-w-[420px] rounded-lg border border-chalk bg-white p-8">
          <p className="eyebrow mb-3">{eyebrow}</p>
          <h1 className="h-display-md">{title}</h1>
          {subtitle && <p className="lead mt-3 text-[15px]">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>

      <p className="ichigo-footer absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
        Equipped to <span className="accent">run.</span>
      </p>
    </div>
  );
}
