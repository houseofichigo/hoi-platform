import { type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { listLibraryItems } from "@/lib/library/queries";
import type { LibraryItem, LibraryType } from "@/lib/library/types";
import { TYPE_SCHEMAS } from "@/lib/library/typeSchemas";
import { LibraryItemCard } from "./LibraryItemCard";

interface Props {
  type: LibraryType;
}

export function DiscoverTypePage({ type }: Props) {
  const schema = TYPE_SCHEMAS[type];
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["library", type, "published"],
    queryFn: () => listLibraryItems({ type }),
  });

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) for (const t of it.tags) s.add(t);
    return Array.from(s).sort();
  }, [items]);
  const allModules = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) for (const m of it.module_ids) s.add(m);
    return Array.from(s).sort();
  }, [items]);
  const allPhases = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) for (const p of it.phase_ids) s.add(p);
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (moduleFilter && !it.module_ids.includes(moduleFilter)) return false;
      if (phaseFilter && !it.phase_ids.includes(phaseFilter)) return false;
      if (tagFilter && !it.tags.includes(tagFilter)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [it.title, it.summary ?? "", it.tags.join(" ")].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, moduleFilter, phaseFilter, tagFilter]);

  const Icon = schema.icon;

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">DISCOVER · {schema.plural.toUpperCase()}</p>
        <h1 className="h-display-md mt-2 flex items-center gap-3">
          <Icon className="h-6 w-6 text-terracotta" />
          {schema.plural}
        </h1>
        <p className="lead mt-2 max-w-[60ch]">{schema.description}</p>
      </header>

      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border border-chalk bg-paper px-3 py-2">
          <Search className="h-4 w-4 text-slate" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${schema.plural.toLowerCase()}…`}
            className="flex-1 bg-transparent text-[14px] text-navy outline-none placeholder:text-slate"
          />
        </div>
        <FilterRow
          label="Module"
          options={allModules}
          value={moduleFilter}
          onChange={setModuleFilter}
        />
        <FilterRow label="Phase" options={allPhases} value={phaseFilter} onChange={setPhaseFilter} />
        <FilterRow label="Tag" options={allTags} value={tagFilter} onChange={setTagFilter} />
      </div>

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState type={type} totalCount={items.length} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((item) => (
            <LibraryItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}): ReactNode {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate">{label}</span>
      <button
        type="button"
        onClick={() => onChange("")}
        className={[
          "rounded-full border px-2.5 py-0.5 text-[12px]",
          value === ""
            ? "border-navy bg-navy text-white"
            : "border-chalk text-slate hover:border-navy hover:text-navy",
        ].join(" ")}
      >
        All
      </button>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o === value ? "" : o)}
          className={[
            "rounded-full border px-2.5 py-0.5 text-[12px]",
            o === value
              ? "border-terracotta bg-terracotta text-white"
              : "border-chalk text-slate hover:border-navy hover:text-navy",
          ].join(" ")}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ type, totalCount }: { type: LibraryType; totalCount: number }) {
  const schema = TYPE_SCHEMAS[type];
  return (
    <div className="card border-l-[3px] border-l-chalk text-center">
      <p className="text-[14px] text-navy">
        {totalCount === 0
          ? `No ${schema.plural.toLowerCase()} have been published yet.`
          : `No ${schema.plural.toLowerCase()} match the current filters.`}
      </p>
      <p className="mt-1 text-[12px] text-slate">
        Check back soon — new resources are added regularly.
      </p>
    </div>
  );
}
