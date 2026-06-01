import { Link, useRouterState } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import type { ModuleId } from "@/lib/curriculum";

type Status = "not_started" | "in_progress" | "complete";

interface Progress {
  status: Status;
  studied: boolean;
}

interface Props {
  workspaceSlug: string;
  moduleId: ModuleId;
  hasGate: boolean;
  progress?: Progress;
  isLoading?: boolean;
}

function Dot({ state }: { state: "empty" | "half" | "full" }) {
  const cls =
    state === "full"
      ? "bg-terracotta border-terracotta"
      : state === "half"
        ? "bg-terracotta/40 border-terracotta"
        : "bg-transparent border-slate/50";
  return <span className={`inline-block h-2 w-2 rounded-full border ${cls}`} aria-hidden />;
}

function TabSkeleton() {
  return (
    <div className="flex items-center gap-2 border-b-[3px] border-transparent px-5 py-4">
      <span className="inline-block h-[19px] w-20 animate-pulse rounded bg-chalk" />
    </div>
  );
}

export function ModuleTabs({ workspaceSlug, moduleId, hasGate, progress, isLoading }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const seg = pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  const isStudy = seg === "study";
  const isWork = seg === "work";
  const isGate = seg === "gate";
  const isOverview = !isStudy && !isWork && !isGate;

  const studied = progress?.studied ?? false;
  const status: Status = progress?.status ?? "not_started";
  const gateUnlocked = status === "complete";

  const tabClass = (active: boolean) =>
    [
      "flex items-center gap-2 border-b-[3px] px-5 py-4 text-[15px] font-semibold transition-colors whitespace-nowrap",
      active
        ? "border-terracotta text-navy"
        : "border-transparent text-graphite hover:text-navy hover:border-slate/30",
    ].join(" ");

  if (isLoading) {
    return (
      <nav className="rounded-md border border-chalk bg-mist/40" aria-busy="true" aria-label="Loading module tabs">
        <div className="flex items-center gap-1 overflow-x-auto px-2">
          <TabSkeleton />
          <TabSkeleton />
          <TabSkeleton />
          {hasGate && <TabSkeleton />}
        </div>
      </nav>
    );
  }

  return (
    <nav className="rounded-md border border-chalk bg-mist/40">
      <div className="flex items-center gap-1 overflow-x-auto px-2">
        <Link
          to="/app/$workspaceSlug/assess/$moduleId"
          params={{ workspaceSlug, moduleId }}
          className={tabClass(isOverview)}
        >
          Overview
        </Link>
        <Link
          to="/app/$workspaceSlug/assess/$moduleId/study"
          params={{ workspaceSlug, moduleId }}
          className={tabClass(isStudy)}
        >
          Study
          <Dot state={studied ? "full" : "empty"} />
        </Link>
        <Link
          to="/app/$workspaceSlug/assess/$moduleId/work"
          params={{ workspaceSlug, moduleId }}
          className={tabClass(isWork)}
        >
          Assignment
          <Dot state={status === "complete" ? "full" : status === "in_progress" ? "half" : "empty"} />
        </Link>
        {hasGate && (
          <Link
            to="/app/$workspaceSlug/assess/$moduleId/gate"
            params={{ workspaceSlug, moduleId }}
            className={tabClass(isGate)}
          >
            Gate
            {gateUnlocked ? (
              <Dot state="empty" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-slate/70" aria-label="Complete assignment to unlock" />
            )}
          </Link>
        )}
      </div>
    </nav>
  );
}

