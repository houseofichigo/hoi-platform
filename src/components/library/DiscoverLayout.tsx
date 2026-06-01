import { type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useWorkspace } from "@/hooks/useWorkspace";
import { TYPE_LIST, LIBRARY_OVERVIEW_ICON } from "@/lib/library/typeSchemas";

export function DiscoverLayout({ children }: { children: ReactNode }) {
  const { workspace } = useWorkspace();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!workspace) return null;
  const slug = workspace.slug;
  const base = `/app/${slug}/discover`;

  const items = [
    { label: "Overview", href: base, icon: LIBRARY_OVERVIEW_ICON },
    ...TYPE_LIST.map((s) => ({ label: s.plural, href: `${base}/${s.slug}`, icon: s.icon })),
  ];

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-[200px_1fr]">
      <aside className="md:sticky md:top-6 md:self-start">
        <p className="eyebrow-muted mb-3">DISCOVER</p>
        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {items.map((it) => {
            const active = pathname === it.href;
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                to={it.href}
                className={[
                  "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  active
                    ? "bg-mist font-medium text-navy"
                    : "text-slate hover:bg-mist hover:text-navy",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" />
                {it.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
