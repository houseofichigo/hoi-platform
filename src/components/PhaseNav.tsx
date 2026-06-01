import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, GraduationCap, Hammer, TrendingUp, type LucideIcon } from "lucide-react";

const PHASES: { id: string; label: string; to: string; icon: LucideIcon }[] = [
  { id: "assess", label: "Assess", to: "/app/$workspaceSlug/assess", icon: GraduationCap },
  { id: "discover", label: "Discover", to: "/app/$workspaceSlug/discover", icon: Compass },
  { id: "build", label: "Build", to: "/app/$workspaceSlug/build", icon: Hammer },
  { id: "scale", label: "Scale", to: "/app/$workspaceSlug/scale", icon: TrendingUp },
];

export function PhaseNav({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="border-b border-chalk bg-paper">
      <div className="mx-auto flex max-w-[1080px] items-center gap-1 overflow-x-auto px-6">
        {PHASES.map((p) => {
          const href = p.to.replace("$workspaceSlug", workspaceSlug);
          const active = pathname === href || pathname.startsWith(href + "/");
          const Icon = p.icon;
          return (
            <Link
              key={p.id}
              to={p.to}
              params={{ workspaceSlug }}
              className={[
                "flex items-center gap-2 border-b-2 px-3 py-3 text-[13px] font-medium transition-colors",
                active
                  ? "border-terracotta text-navy"
                  : "border-transparent text-slate hover:text-navy",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {p.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
