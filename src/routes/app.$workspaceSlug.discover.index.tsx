import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWorkspaceProfile } from "@/hooks/useWorkspaceProfile";
import { listLibraryItems } from "@/lib/library/queries";
import { addLibraryItemToRoadmap } from "@/lib/library/roadmap.functions";
import type { LibraryItem } from "@/lib/library/types";
import { TYPE_LIST, TYPE_SCHEMAS } from "@/lib/library/typeSchemas";
import { LibraryItemCard } from "@/components/library/LibraryItemCard";

export const Route = createFileRoute("/app/$workspaceSlug/discover/")({
  component: DiscoverHome,
});

function DiscoverHome() {
  const { workspace, isAdmin } = useWorkspace();
  const { data: profile } = useWorkspaceProfile();
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const addToRoadmapFn = useServerFn(addLibraryItemToRoadmap);

  const { data: items = [] } = useQuery({
    queryKey: ["library", "all", "published"],
    queryFn: () => listLibraryItems({}),
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const it of items) c[it.type] = (c[it.type] ?? 0) + 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return items.filter((it) =>
      [it.title, it.summary ?? "", it.tags.join(" ")].join(" ").toLowerCase().includes(q),
    );
  }, [items, search]);

  const recent = useMemo(() => items.slice(0, 6), [items]);
  const recommended = useMemo(() => recommendForProfile(items, profile), [items, profile]);
  const addToRoadmap = useMutation({
    mutationFn: (item: LibraryItem) => {
      if (!workspace) throw new Error("Workspace not ready");
      return addToRoadmapFn({ data: { workspaceId: workspace.id, libraryItemId: item.id } });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Added to Deploy roadmap");
      qc.invalidateQueries({ queryKey: ["scale", "roadmap_entries", workspace?.id] });
      qc.invalidateQueries({ queryKey: ["use_cases", workspace?.id] });
    },
    onError: (error) => toast.error((error as Error).message),
  });
  if (!workspace) return null;
  const slug = workspace.slug;

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">DISCOVER · LIBRARY</p>
        <h1 className="h-display-md mt-2 max-w-[24ch]">
          Find what helps you <span className="accent-italic">build.</span>
        </h1>
        <p className="lead mt-2 max-w-[60ch]">
          Prompts, agents, tools, videos, case studies, and more — curated by House of Ichigo.
        </p>
      </header>

      <div className="flex items-center gap-2 rounded-md border border-chalk bg-paper px-3 py-2.5">
        <Search className="h-4 w-4 text-slate" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the whole library…"
          className="flex-1 bg-transparent text-[14px] text-navy outline-none placeholder:text-slate"
        />
      </div>

      {search.trim() ? (
        <section>
          <p className="eyebrow-muted mb-3">RESULTS · {filtered.length}</p>
          {filtered.length === 0 ? (
            <p className="text-[13px] text-slate">No matches yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filtered.map((it) => (
                <LibraryItemCard
                  key={it.id}
                  item={it}
                  onAddToRoadmap={isAdmin ? (item) => addToRoadmap.mutate(item) : undefined}
                  addToRoadmapDisabled={addToRoadmap.isPending}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow-muted mb-3">RECOMMENDED FOR YOUR WORKSPACE</p>
              </div>
              {profile?.country && (
                <span className="rounded-full border border-chalk bg-mist px-2 py-0.5 text-[11px] text-slate">
                  {profile.country as string}
                </span>
              )}
            </div>
            {recommended.length === 0 ? (
              <div className="card border-l-[3px] border-l-chalk">
                <p className="text-[14px] text-navy">Recommendations will sharpen after your company profile is complete.</p>
                <p className="mt-1 text-[12px] text-slate">
                  Add entity type, regulatory overlays, and data residency sensitivity in Settings.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {recommended.map((row) => (
                  <LibraryItemCard
                    key={row.item.id}
                    item={row.item}
                    recommendationReason={row.reason}
                    onAddToRoadmap={isAdmin ? (item) => addToRoadmap.mutate(item) : undefined}
                    addToRoadmapDisabled={addToRoadmap.isPending}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <p className="eyebrow-muted mb-3">CATEGORIES</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {TYPE_LIST.map((s) => {
                const Icon = s.icon;
                return (
                  <Link
                    key={s.id}
                    to="/app/$workspaceSlug/discover/$"
                    params={{ workspaceSlug: slug, _splat: s.slug }}
                    className="group card flex flex-col gap-2 transition-colors hover:border-terracotta"
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="h-4 w-4 text-terracotta" />
                      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate">
                        {counts[s.id] ?? 0}
                      </span>
                    </div>
                    <p className="text-[14px] font-medium text-navy">{s.plural}</p>
                    <p className="text-[12px] leading-snug text-slate">{s.description}</p>
                  </Link>
                );
              })}
            </div>
          </section>

          {recent.length > 0 && (
            <section>
              <p className="eyebrow-muted mb-3">RECENT</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {recent.map((it) => (
                  <LibraryItemCard
                    key={it.id}
                    item={it}
                    onAddToRoadmap={isAdmin ? (item) => addToRoadmap.mutate(item) : undefined}
                    addToRoadmapDisabled={addToRoadmap.isPending}
                  />
                ))}
              </div>
            </section>
          )}

          {items.length === 0 && (
            <div className="card border-l-[3px] border-l-chalk">
              <p className="text-[14px] text-navy">The library is being populated.</p>
              <p className="mt-1 text-[12px] text-slate">
                Resources will appear here as the House of Ichigo team publishes them.
              </p>
            </div>
          )}
        </>
      )}

      {/* dev hint suppression */}
      <span className="sr-only">{TYPE_SCHEMAS.prompts.label}</span>
    </div>
  );
}

function recommendForProfile(
  items: LibraryItem[],
  profile: Record<string, string | string[] | undefined> | null | undefined,
): Array<{ item: LibraryItem; reason: string }> {
  if (!profile) return [];
  const signals = [
    profile.country,
    profile.industry,
    profile.entity_type,
    profile.data_residency_sensitivity,
    ...(Array.isArray(profile.regulatory_overlays) ? profile.regulatory_overlays : []),
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.toLowerCase());

  if (signals.length === 0) return [];

  return items
    .map((item) => {
      const haystack = [
        item.title,
        item.summary ?? "",
        item.tags.join(" "),
        JSON.stringify(item.metadata ?? {}),
      ]
        .join(" ")
        .toLowerCase();
      const matchedSignals = signals.filter((signal) => haystack.includes(signal));
      const signalScore = matchedSignals.length * 2;
      const governanceScore = ["eu ai act", "gdpr", "iso 42001", "nist", "security", "governance"].reduce(
        (score, signal) => score + (haystack.includes(signal) ? 1 : 0),
        0,
      );
      const reason =
        matchedSignals.length > 0
          ? `Recommended because it matches ${matchedSignals.slice(0, 3).join(", ")}.`
          : "Recommended because it carries EU/HOI governance relevance.";
      return { item, score: signalScore + governanceScore, reason };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.item.created_at.localeCompare(a.item.created_at))
    .slice(0, 4)
    .map((row) => ({ item: row.item, reason: row.reason }));
}
