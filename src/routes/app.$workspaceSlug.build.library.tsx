import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight, Plus, Search, SlidersHorizontal, LayoutGrid, Table2,
  MoreHorizontal, Trash2, X, AlertTriangle, ShieldAlert, Shield, Eye,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useUseCases, useScores, type ScoreRow, type UseCaseRow } from "@/hooks/useBuild";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/$workspaceSlug/build/library")({
  component: LibraryPage,
});

type ViewMode = "cards" | "table";
type SortMode =
  | "newest" | "oldest"
  | "score-high" | "score-low"
  | "impact-high" | "readiness-high" | "risk-high"
  | "a-z" | "z-a";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", capturing: "Capturing", ready_to_score: "Ready to score",
  scored: "Scored", submitted: "Submitted", approved: "Approved",
  rejected: "Rejected", archived: "Archived",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-chalk text-graphite",
  capturing: "bg-chalk text-graphite",
  ready_to_score: "bg-amber-100 text-amber-900",
  scored: "bg-blue-100 text-blue-900",
  submitted: "bg-blue-100 text-blue-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900",
  archived: "bg-chalk text-slate",
};

const CLASSIFICATION_TONE: Record<string, string> = {
  "Automation": "bg-emerald-100 text-emerald-900 border-emerald-200",
  "AI Assistant": "bg-blue-100 text-blue-900 border-blue-200",
  "AI Workflow": "bg-violet-100 text-violet-900 border-violet-200",
  "AI Agent": "bg-amber-100 text-amber-900 border-amber-200",
  "Not Ready": "bg-rose-100 text-rose-900 border-rose-200",
};

const SORT_LABEL: Record<SortMode, string> = {
  "newest": "Newest first", "oldest": "Oldest first",
  "score-high": "Priority — high", "score-low": "Priority — low",
  "impact-high": "Impact — high", "readiness-high": "Readiness — high",
  "risk-high": "Risk — high",
  "a-z": "Name A → Z", "z-a": "Name Z → A",
};

const HARD_STOP_CODES = new Set([
  "DATA_NOT_EXIST", "REGULATORY_BLOCK", "NO_OWNER", "OWNER_MISSING",
]);
const MAJOR_CODES = new Set([
  "DATA_NOT_ACCESSIBLE", "NO_API", "NO_MONITORING", "MONITORING_MISSING",
  "RULES_UNDOCUMENTED", "LOW_STANDARDIZATION",
]);

type Sev = "hard_stop" | "major_blocker" | "design_constraint" | "watch_item";
function severityFor(code: string): Sev {
  if (HARD_STOP_CODES.has(code)) return "hard_stop";
  if (MAJOR_CODES.has(code)) return "major_blocker";
  if (code.startsWith("DATA_") || code.startsWith("NO_")) return "design_constraint";
  return "watch_item";
}

function MiniBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-chalk overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${v}%` }} />
      </div>
      <span className="font-mono text-[10px] text-graphite tabular-nums w-7 text-right">{Math.round(v)}</span>
    </div>
  );
}

function ClassificationPill({ value }: { value?: string | null }) {
  const label = value || "Unscored";
  const tone = value ? CLASSIFICATION_TONE[value] ?? "bg-chalk text-graphite border-chalk" : "bg-paper text-slate border-chalk";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", tone)}>
      {label}
    </span>
  );
}

function SeverityIcons({ codes }: { codes: string[] }) {
  const counts = useMemo(() => {
    const c: Record<Sev, number> = { hard_stop: 0, major_blocker: 0, design_constraint: 0, watch_item: 0 };
    codes.forEach((x) => c[severityFor(x)]++);
    return c;
  }, [codes]);
  if (!codes.length) return <span className="text-[10px] font-mono text-slate">Clear</span>;
  return (
    <div className="flex items-center gap-1.5">
      {counts.hard_stop > 0 && (
        <span className="inline-flex items-center gap-0.5 text-rose-700" title={`${counts.hard_stop} hard stop(s)`}>
          <AlertTriangle className="h-3 w-3" /><span className="text-[10px] tabular-nums">{counts.hard_stop}</span>
        </span>
      )}
      {counts.major_blocker > 0 && (
        <span className="inline-flex items-center gap-0.5 text-amber-700" title={`${counts.major_blocker} major blocker(s)`}>
          <ShieldAlert className="h-3 w-3" /><span className="text-[10px] tabular-nums">{counts.major_blocker}</span>
        </span>
      )}
      {counts.design_constraint > 0 && (
        <span className="inline-flex items-center gap-0.5 text-yellow-700" title={`${counts.design_constraint} design constraint(s)`}>
          <Shield className="h-3 w-3" /><span className="text-[10px] tabular-nums">{counts.design_constraint}</span>
        </span>
      )}
      {counts.watch_item > 0 && (
        <span className="inline-flex items-center gap-0.5 text-slate" title={`${counts.watch_item} watch item(s)`}>
          <Eye className="h-3 w-3" /><span className="text-[10px] tabular-nums">{counts.watch_item}</span>
        </span>
      )}
    </div>
  );
}

function LibraryPage() {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: useCases = [], isLoading } = useUseCases();
  const { data: scores = [] } = useScores();

  const [view, setView] = useState<ViewMode>("cards");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("score-high");
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const [classSel, setClassSel] = useState<string[]>([]);
  const [funcSel, setFuncSel] = useState<string[]>([]);
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<UseCaseRow | null>(null);

  const scoreByUc = useMemo(() => {
    const m = new Map<string, ScoreRow>();
    scores.forEach((s) => m.set(s.use_case_id, s));
    return m;
  }, [scores]);

  const allFunctions = useMemo(
    () => Array.from(new Set(useCases.map((u) => u.function).filter(Boolean))).sort(),
    [useCases]
  );

  const filtered = useMemo(() => {
    let list = useCases.map((u) => ({ u, s: scoreByUc.get(u.id) }));
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(({ u }) =>
        u.name.toLowerCase().includes(q) || (u.function ?? "").toLowerCase().includes(q)
      );
    }
    if (statusSel.length) list = list.filter(({ u }) => statusSel.includes(u.status));
    if (classSel.length) list = list.filter(({ s }) => s?.classification && classSel.includes(s.classification));
    if (funcSel.length) list = list.filter(({ u }) => funcSel.includes(u.function));
    list = list.filter(({ s }) => {
      const p = Number(s?.priority ?? 0);
      return p >= scoreRange[0] && p <= scoreRange[1];
    });
    if (onlyBlocked) list = list.filter(({ s }) => (s?.reason_codes ?? []).length > 0);

    const cmpNum = (a?: number | null, b?: number | null) => (Number(b ?? 0) - Number(a ?? 0));
    list.sort((A, B) => {
      switch (sort) {
        case "newest": return +new Date(B.u.created_at) - +new Date(A.u.created_at);
        case "oldest": return +new Date(A.u.created_at) - +new Date(B.u.created_at);
        case "score-high": return cmpNum(A.s?.priority, B.s?.priority);
        case "score-low": return -cmpNum(A.s?.priority, B.s?.priority);
        case "impact-high": return cmpNum(A.s?.business_impact, B.s?.business_impact);
        case "readiness-high": return cmpNum(A.s?.delivery_readiness, B.s?.delivery_readiness);
        case "risk-high": return cmpNum(A.s?.risk, B.s?.risk);
        case "a-z": return A.u.name.localeCompare(B.u.name);
        case "z-a": return B.u.name.localeCompare(A.u.name);
      }
    });
    return list;
  }, [useCases, scoreByUc, query, statusSel, classSel, funcSel, scoreRange, onlyBlocked, sort]);

  const activeFilterCount =
    statusSel.length + classSel.length + funcSel.length +
    (scoreRange[0] !== 0 || scoreRange[1] !== 100 ? 1 : 0) +
    (onlyBlocked ? 1 : 0);

  const clearAll = () => {
    setStatusSel([]); setClassSel([]); setFuncSel([]);
    setScoreRange([0, 100]); setOnlyBlocked(false);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { error } = await supabase.from("use_cases").delete().eq("id", pendingDelete.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Use case deleted");
    setPendingDelete(null);
    qc.invalidateQueries({ queryKey: ["use_cases"] });
  };

  if (!workspace) return null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search use cases…"
            className="w-full rounded-md border border-chalk bg-paper py-2 pl-9 pr-3 text-[14px] outline-none focus:border-terracotta"
          />
        </div>

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <button className="inline-flex items-center gap-2 rounded-md border border-chalk bg-paper px-3 py-2 text-[13px] hover:border-graphite">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-terracotta px-1.5 py-0.5 text-[10px] font-mono text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[360px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="font-display text-navy">Filters</SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <FilterGroup title="Status">
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <CheckRow key={k} label={v} checked={statusSel.includes(k)}
                    onChange={(c) => setStatusSel((p) => c ? [...p, k] : p.filter((x) => x !== k))} />
                ))}
              </FilterGroup>

              <FilterGroup title="Classification">
                {Object.keys(CLASSIFICATION_TONE).map((k) => (
                  <CheckRow key={k} label={k} checked={classSel.includes(k)}
                    onChange={(c) => setClassSel((p) => c ? [...p, k] : p.filter((x) => x !== k))} />
                ))}
              </FilterGroup>

              {allFunctions.length > 0 && (
                <FilterGroup title="Function">
                  {allFunctions.map((f) => (
                    <CheckRow key={f} label={f} checked={funcSel.includes(f)}
                      onChange={(c) => setFuncSel((p) => c ? [...p, f] : p.filter((x) => x !== f))} />
                  ))}
                </FilterGroup>
              )}

              <FilterGroup title={`Priority score: ${scoreRange[0]} – ${scoreRange[1]}`}>
                <Slider
                  value={scoreRange}
                  onValueChange={(v) => setScoreRange([v[0], v[1]] as [number, number])}
                  min={0} max={100} step={5}
                  className="mt-2"
                />
              </FilterGroup>

              <FilterGroup title="Quality">
                <CheckRow label="Only blocked (has reason codes)" checked={onlyBlocked} onChange={setOnlyBlocked} />
              </FilterGroup>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-chalk pt-4">
              <button onClick={clearAll} className="text-[12px] text-graphite hover:text-terracotta underline underline-offset-4">
                Clear all
              </button>
              <button onClick={() => setFiltersOpen(false)} className="rounded-md bg-navy px-4 py-2 text-[13px] text-white hover:opacity-90">
                Done
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border border-chalk bg-paper px-3 py-2 text-[13px] hover:border-graphite">
            Sort: <span className="text-graphite">{SORT_LABEL[sort]}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(SORT_LABEL) as SortMode[]).map((k) => (
              <DropdownMenuItem key={k} onClick={() => setSort(k)}>{SORT_LABEL[k]}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="inline-flex rounded-md border border-chalk bg-paper p-0.5">
          <button onClick={() => setView("cards")}
            className={cn("inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[12px]",
              view === "cards" ? "bg-navy text-white" : "text-graphite hover:text-navy")}>
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </button>
          <button onClick={() => setView("table")}
            className={cn("inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[12px]",
              view === "table" ? "bg-navy text-white" : "text-graphite hover:text-navy")}>
            <Table2 className="h-3.5 w-3.5" /> Table
          </button>
        </div>

        <Link
          to="/app/$workspaceSlug/build/capture"
          params={{ workspaceSlug: workspace.slug }}
          className="inline-flex items-center gap-2 rounded-md bg-terracotta px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New use case
        </Link>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {statusSel.map((s) => (
            <Chip key={`st-${s}`} label={STATUS_LABEL[s]} onClear={() => setStatusSel((p) => p.filter((x) => x !== s))} />
          ))}
          {classSel.map((s) => (
            <Chip key={`cl-${s}`} label={s} onClear={() => setClassSel((p) => p.filter((x) => x !== s))} />
          ))}
          {funcSel.map((s) => (
            <Chip key={`fn-${s}`} label={s} onClear={() => setFuncSel((p) => p.filter((x) => x !== s))} />
          ))}
          {(scoreRange[0] !== 0 || scoreRange[1] !== 100) && (
            <Chip label={`Score ${scoreRange[0]}–${scoreRange[1]}`} onClear={() => setScoreRange([0, 100])} />
          )}
          {onlyBlocked && <Chip label="Blocked only" onClear={() => setOnlyBlocked(false)} />}
          <button onClick={clearAll} className="text-[11px] text-graphite hover:text-terracotta underline underline-offset-4">
            Clear all
          </button>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate">
        {filtered.length} of {useCases.length} use cases
      </p>

      {/* Content */}
      {isLoading ? (
        <p className="text-[13px] text-graphite">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 border-dashed">
          <p className="font-display text-[20px] text-navy">
            {useCases.length === 0 ? "Capture your first use case" : "No matches"}
          </p>
          <p className="mt-1 text-[13px] text-graphite">
            {useCases.length === 0
              ? "Start by describing a business process you'd like to evaluate."
              : "Try adjusting filters or clearing your search."}
          </p>
          {useCases.length === 0 && (
            <Link
              to="/app/$workspaceSlug/build/capture"
              params={{ workspaceSlug: workspace.slug }}
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-terracotta px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Create use case
            </Link>
          )}
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ u, s }) => (
            <UseCaseCard
              key={u.id}
              u={u}
              s={s}
              workspaceSlug={workspace.slug}
              onDelete={() => setPendingDelete(u)}
            />
          ))}
        </div>
      ) : (
        <UseCaseTable
          rows={filtered}
          workspaceSlug={workspace.slug}
          onOpen={(id) => navigate({
            to: "/app/$workspaceSlug/build/capture/$useCaseId",
            params: { workspaceSlug: workspace.slug, useCaseId: id },
          })}
          onDelete={setPendingDelete}
        />
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this use case?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” and all its captured data will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-graphite cursor-pointer hover:text-navy">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span>{label}</span>
    </label>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-chalk bg-paper px-2.5 py-1 text-[11px] text-graphite">
      {label}
      <button onClick={onClear} className="text-slate hover:text-terracotta"><X className="h-3 w-3" /></button>
    </span>
  );
}

function UseCaseCard({
  u, s, workspaceSlug, onDelete,
}: { u: UseCaseRow; s?: ScoreRow; workspaceSlug: string; onDelete: () => void }) {
  const impact = Number(s?.business_impact ?? 0);
  const readiness = Number(s?.delivery_readiness ?? 0);
  const risk = Number(s?.risk ?? 0);
  const priority = Number(s?.priority ?? 0);

  return (
    <div className="card group relative hover:border-terracotta transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
            {u.function || "—"} · <span className={cn("inline-block px-1.5 rounded", STATUS_TONE[u.status] ?? "bg-chalk")}>
              {STATUS_LABEL[u.status] ?? u.status}
            </span>
          </p>
          <Link
            to="/app/$workspaceSlug/build/capture/$useCaseId"
            params={{ workspaceSlug, useCaseId: u.id }}
            className="block mt-1 font-display text-[18px] text-navy line-clamp-2 hover:text-terracotta"
          >
            {u.name}
          </Link>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-md p-1.5 text-graphite opacity-0 group-hover:opacity-100 hover:bg-chalk transition-opacity">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/app/$workspaceSlug/build/capture/$useCaseId" params={{ workspaceSlug, useCaseId: u.id }}>
                Open
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-rose-700 focus:text-rose-700">
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {u.description && (
        <p className="mt-2 text-[13px] text-graphite line-clamp-2">{u.description}</p>
      )}

      <div className="mt-4 space-y-1.5">
        <MiniBar label="Impact" value={impact} tone="bg-emerald-500" />
        <MiniBar label="Ready" value={readiness} tone="bg-blue-500" />
        <MiniBar label="Risk" value={risk} tone="bg-rose-500" />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <ClassificationPill value={s?.classification} />
        <SeverityIcons codes={s?.reason_codes ?? []} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-chalk pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
          Priority <span className="text-navy text-[12px] tabular-nums">{Math.round(priority)}</span>
        </span>
        <Link
          to="/app/$workspaceSlug/build/capture/$useCaseId"
          params={{ workspaceSlug, useCaseId: u.id }}
          className="inline-flex items-center gap-1 text-[12px] text-terracotta hover:underline"
        >
          Open <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function UseCaseTable({
  rows, workspaceSlug, onOpen, onDelete,
}: {
  rows: { u: UseCaseRow; s?: ScoreRow }[];
  workspaceSlug: string;
  onOpen: (id: string) => void;
  onDelete: (u: UseCaseRow) => void;
}) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-chalk text-left">
            {["Name", "Function", "Status", "Classification", "Impact", "Ready", "Risk", "Priority", "Signals", ""].map((h) => (
              <th key={h} className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ u, s }) => (
            <tr
              key={u.id}
              className="border-b border-chalk last:border-b-0 hover:bg-paper/60 cursor-pointer"
              onClick={() => onOpen(u.id)}
            >
              <td className="px-3 py-2.5 text-navy font-medium max-w-[260px] truncate">{u.name}</td>
              <td className="px-3 py-2.5 text-graphite">{u.function || "—"}</td>
              <td className="px-3 py-2.5">
                <span className={cn("inline-block rounded px-1.5 py-0.5 text-[11px]", STATUS_TONE[u.status] ?? "bg-chalk")}>
                  {STATUS_LABEL[u.status] ?? u.status}
                </span>
              </td>
              <td className="px-3 py-2.5"><ClassificationPill value={s?.classification} /></td>
              <td className="px-3 py-2.5 w-[120px]"><MiniBar label="" value={Number(s?.business_impact ?? 0)} tone="bg-emerald-500" /></td>
              <td className="px-3 py-2.5 w-[120px]"><MiniBar label="" value={Number(s?.delivery_readiness ?? 0)} tone="bg-blue-500" /></td>
              <td className="px-3 py-2.5 w-[120px]"><MiniBar label="" value={Number(s?.risk ?? 0)} tone="bg-rose-500" /></td>
              <td className="px-3 py-2.5 font-mono text-[12px] text-navy tabular-nums">{Math.round(Number(s?.priority ?? 0))}</td>
              <td className="px-3 py-2.5"><SeverityIcons codes={s?.reason_codes ?? []} /></td>
              <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger className="rounded p-1 hover:bg-chalk">
                    <MoreHorizontal className="h-4 w-4 text-graphite" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onOpen(u.id)}>Open</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(u)} className="text-rose-700 focus:text-rose-700">
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
