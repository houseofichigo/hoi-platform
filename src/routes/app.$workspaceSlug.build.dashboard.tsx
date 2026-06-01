import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight, Search, Sparkles, AlertOctagon, ShieldAlert, Eye, CheckCircle2,
  TrendingUp, Filter as FilterIcon, ExternalLink, Activity,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useUseCases, useScores, useApprovals, useGovernanceFlagsAll,
  type ScoreRow, type UseCaseRow,
} from "@/hooks/useBuild";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  bucketOf, recommendedActions, BUCKET_META, BUCKET_ORDER,
  type DecisionBucket, type RecommendedAction,
} from "@/lib/build/dashboardBuckets";

export const Route = createFileRoute("/app/$workspaceSlug/build/dashboard")({
  component: DashboardPage,
});

// ============================================================================
// Severity taxonomy — mirrors scoring engine (REASON_CODE_SEVERITY)
// ============================================================================
const HARD_STOPS = new Set([
  "NO_SUCCESS_METRIC", "NO_DATA_ACCESS", "NO_API",
  "DATA_NOT_ACCESSIBLE", "SCOPE_UNDEFINED",
]);
const DESIGN_CONSTRAINTS = new Set([
  "HITL_MANDATORY", "IRREVERSIBLE_ERRORS", "HIGH_EXCEPTION_RATE",
  "PII_PRESENT", "FOREIGN_DATA_ACCESS", "STEP_AUTOMATION_UNSAFE",
]);

type Sev = "hard_stop" | "design_constraint" | "watch_item";
function sevOf(code: string): Sev {
  if (HARD_STOPS.has(code)) return "hard_stop";
  if (DESIGN_CONSTRAINTS.has(code)) return "design_constraint";
  return "watch_item";
}

const SEV_TONE: Record<Sev, string> = {
  hard_stop: "bg-rose-100 text-rose-900 border-rose-200",
  design_constraint: "bg-amber-100 text-amber-900 border-amber-200",
  watch_item: "bg-slate-100 text-slate-700 border-slate-200",
};
const SEV_DOT: Record<Sev, string> = {
  hard_stop: "fill-rose-500",
  design_constraint: "fill-amber-500",
  watch_item: "fill-slate-400",
};
const SEV_LABEL: Record<Sev, string> = {
  hard_stop: "Hard stop",
  design_constraint: "Design constraint",
  watch_item: "Watch item",
};

const REASON_LABELS: Record<string, string> = {
  NO_SUCCESS_METRIC: "No success metric defined",
  NO_DATA_ACCESS: "No data access path",
  NO_API: "No API — manual access only",
  DATA_NOT_ACCESSIBLE: "Data not accessible / poor",
  SCOPE_UNDEFINED: "Scope undefined",
  HITL_MANDATORY: "HITL mandatory",
  IRREVERSIBLE_ERRORS: "Errors are irreversible",
  HIGH_EXCEPTION_RATE: "High exception rate",
  PII_PRESENT: "PII present",
  FOREIGN_DATA_ACCESS: "Foreign vendor data access",
  STEP_AUTOMATION_UNSAFE: "Step automation unsafe",
  LOW_STANDARDIZATION: "Low standardisation",
  NO_MONITORING_PATH: "No monitoring path",
  NO_ROLLBACK_PATH: "No rollback path",
  RULES_UNDOCUMENTED: "Rules undocumented",
  NO_HISTORICAL_DATA: "No historical data",
  TRIGGER_MANUAL: "Manual trigger",
  OUTPUT_NOT_VERIFIABLE: "Output not verifiable",
  NO_PROCESS_OWNER: "No process owner",
};

const QUADRANTS = [
  { k: "quick-wins", label: "Start now", desc: "High priority · ready", tone: "border-emerald-300 bg-emerald-50/40" },
  { k: "strategic-projects", label: "Plan", desc: "High priority · not ready", tone: "border-amber-300 bg-amber-50/40" },
  { k: "tactical-improvements", label: "Reshape", desc: "Lower priority · ready", tone: "border-blue-300 bg-blue-50/40" },
  { k: "foundational-rebuilds", label: "Fix foundations", desc: "Low readiness or hard stops", tone: "border-slate-300 bg-slate-50/40" },
] as const;

// ============================================================================
// Quick-view chips — saved filter combos surfaced above the board
// ============================================================================
type QuickChip =
  | "hard_stops"
  | "gate2_blocked"
  | "missing_owner"
  | "agent_eligible"
  | "data_issue"
  | "pii"
  | "stalled";

const QUICK_CHIPS: { k: QuickChip; label: string; tone: string }[] = [
  { k: "hard_stops",      label: "Hard stops",       tone: "border-rose-300 text-rose-900" },
  { k: "gate2_blocked",   label: "Gate 2 blocked",   tone: "border-amber-300 text-amber-900" },
  { k: "missing_owner",   label: "Missing owner",    tone: "border-amber-300 text-amber-900" },
  { k: "agent_eligible",  label: "Agent-eligible",   tone: "border-terracotta/40 text-terracotta" },
  { k: "data_issue",      label: "Data issue",       tone: "border-rose-300 text-rose-900" },
  { k: "pii",             label: "PII",              tone: "border-violet-300 text-violet-900" },
  { k: "stalled",         label: "Stalled 14d+",     tone: "border-slate-300 text-slate-700" },
];

const DATA_ISSUE_CODES = new Set([
  "NO_DATA_ACCESS", "NO_API", "DATA_NOT_ACCESSIBLE", "NO_HISTORICAL_DATA",
]);

function matchesChip(r: Row, chip: QuickChip): boolean {
  switch (chip) {
    case "hard_stops":     return r.hasHardStop;
    case "gate2_blocked":  return r.gateStatuses?.gate_2?.status === "FAIL";
    case "missing_owner":  return r.reasonCodes.includes("NO_PROCESS_OWNER");
    case "agent_eligible": return r.classification === "AI Agent" || r.agentSuit >= 60;
    case "data_issue":     return r.reasonCodes.some((c) => DATA_ISSUE_CODES.has(c));
    case "pii":            return r.reasonCodes.includes("PII_PRESENT");
    case "stalled": {
      const t = r.score?.scored_at;
      if (!t) return false;
      const TWO_WEEKS = 14 * 24 * 3600 * 1000;
      return Date.now() - new Date(t).getTime() > TWO_WEEKS
        && !["submitted", "approved", "rejected"].includes(r.uc.status);
    }
  }
}

// ============================================================================
// Mini primitives
// ============================================================================
function MiniBar({ value, tone = "bg-navy" }: { value: number; tone?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className="h-1 w-full rounded-full bg-chalk overflow-hidden">
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${v}%` }} />
    </div>
  );
}

function KpiTile({ label, value, hint, icon: Icon, tone }: {
  label: string; value: number | string; hint?: string;
  icon?: React.ComponentType<{ className?: string }>; tone?: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate">{label}</p>
        {Icon && <Icon className={cn("h-4 w-4", tone ?? "text-terracotta")} />}
      </div>
      <p className="mt-2 font-display text-[28px] leading-none text-navy">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-graphite">{hint}</p>}
    </div>
  );
}

// ============================================================================
// Data model — derived row joining use case + score
// ============================================================================
interface Row {
  uc: UseCaseRow;
  score: ScoreRow | null;
  priority: number;
  readiness: number;
  impact: number;
  risk: number;
  agentSuit: number;
  quadrant: string;
  classification: string;
  reasonCodes: string[];
  topSev: Sev | null;
  hasHardStop: boolean;
  gateStatuses: ScoreRow["gate_statuses"];
  govCount: number;
  bucket: DecisionBucket;
}

function buildRows(
  useCases: UseCaseRow[],
  scores: ScoreRow[],
  govByUc: Map<string, number>,
): Row[] {
  const byUc = new Map(scores.map((s) => [s.use_case_id, s]));
  return useCases.map((uc) => {
    const s = byUc.get(uc.id) ?? null;
    const codes = s?.reason_codes ?? [];
    const sevs = codes.map(sevOf);
    const topSev: Sev | null = sevs.includes("hard_stop")
      ? "hard_stop"
      : sevs.includes("design_constraint")
      ? "design_constraint"
      : sevs.length
      ? "watch_item"
      : null;
    const priority = Number(s?.priority ?? 0);
    const readiness = Number(s?.delivery_readiness ?? 0);
    const quadrant = s?.quadrant ?? "foundational-rebuilds";
    const hasHardStop = sevs.includes("hard_stop");
    const govCount = govByUc.get(uc.id) ?? 0;
    return {
      uc,
      score: s,
      priority,
      readiness,
      impact: Number(s?.business_impact ?? 0),
      risk: Number(s?.risk ?? 0),
      agentSuit: Number(s?.agent_suitability ?? 0),
      quadrant,
      classification: s?.classification ?? "—",
      reasonCodes: codes,
      topSev,
      hasHardStop,
      gateStatuses: s?.gate_statuses ?? {},
      govCount,
      bucket: bucketOf({
        priority, readiness, quadrant, reasonCodes: codes, govCount, hasHardStop,
      }),
    };
  });
}

// ============================================================================
// Page
// ============================================================================
function DashboardPage() {
  const { workspace } = useWorkspace();
  const { data: useCases = [] } = useUseCases();
  const { data: scores = [] } = useScores();
  const { data: approvals = [] } = useApprovals();
  const { data: govFlags = [] } = useGovernanceFlagsAll();

  // ---- Filters
  const [q, setQ] = useState("");
  const [fnFilter, setFnFilter] = useState<Set<string>>(new Set());
  const [quadFilter, setQuadFilter] = useState<Set<string>>(new Set());
  const [sevFilter, setSevFilter] = useState<Set<Sev>>(new Set());
  const [priorityRange, setPriorityRange] = useState<[number, number]>([0, 100]);
  const [govOnly, setGovOnly] = useState(false);
  const [chip, setChip] = useState<QuickChip | null>(null);
  const [boardMode, setBoardMode] = useState<"quadrants" | "buckets">("quadrants");

  // ---- Selection
  const [selected, setSelected] = useState<Row | null>(null);

  const govByUc = useMemo(() => {
    const m = new Map<string, number>();
    govFlags.forEach((g) => m.set(g.use_case_id, (m.get(g.use_case_id) ?? 0) + 1));
    return m;
  }, [govFlags]);

  const allRows = useMemo(
    () => buildRows(useCases, scores as ScoreRow[], govByUc),
    [useCases, scores, govByUc],
  );

  const functions = useMemo(
    () => Array.from(new Set(useCases.map((u) => u.function).filter(Boolean))),
    [useCases],
  );

  const rows = useMemo(() => {
    return allRows.filter((r) => {
      if (q && !r.uc.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (fnFilter.size && !fnFilter.has(r.uc.function)) return false;
      if (quadFilter.size && !quadFilter.has(r.quadrant)) return false;
      if (sevFilter.size && (!r.topSev || !sevFilter.has(r.topSev))) return false;
      if (r.priority < priorityRange[0] || r.priority > priorityRange[1]) return false;
      if (govOnly && r.govCount === 0) return false;
      if (chip && !matchesChip(r, chip)) return false;
      return true;
    });
  }, [allRows, q, fnFilter, quadFilter, sevFilter, priorityRange, govOnly, chip]);

  // ---- KPIs
  const kpis = useMemo(() => {
    const ready = rows.filter((r) => r.quadrant === "quick-wins" && !r.hasHardStop).length;
    const needsDesign = rows.filter((r) => r.quadrant === "strategic-projects").length;
    const blocked = rows.filter((r) => r.hasHardStop).length;
    const watch = rows.filter((r) => r.topSev === "watch_item").length;
    const avg = rows.length
      ? Math.round(rows.reduce((a, r) => a + r.priority, 0) / rows.length)
      : 0;
    return { ready, needsDesign, blocked, watch, avg };
  }, [rows]);

  // ---- Recommendation engine
  const recommendation = useMemo(() => {
    const pending = approvals.filter((a) => a.decision === "pending").length;
    if (kpis.blocked > 0)
      return {
        title: `${kpis.blocked} use case${kpis.blocked > 1 ? "s" : ""} blocked by hard stops`,
        body: "Resolve missing success metrics, data access, or scope before scoring.",
        cta: "Open Blockers",
        tab: "blockers" as const,
      };
    if (kpis.ready > 0)
      return {
        title: `${kpis.ready} ready to approve`,
        body: "These sit in Start-now with no design constraint — push them to Scale.",
        cta: "Open Approvals",
        tab: "decision" as const,
      };
    if (pending > 0)
      return {
        title: `${pending} approval${pending > 1 ? "s" : ""} pending review`,
        body: "Decisions waiting on workspace admin.",
        cta: "Review",
        tab: "decision" as const,
      };
    if (kpis.needsDesign > 0)
      return {
        title: `${kpis.needsDesign} high-priority, low-readiness`,
        body: "Tighten process maturity & data feasibility to unlock pilots.",
        cta: "See heatmap",
        tab: "heatmap" as const,
      };
    return {
      title: "Portfolio is clean",
      body: "No hard stops. Keep mapping new use cases.",
      cta: "View library",
      tab: "decision" as const,
    };
  }, [kpis, approvals]);

  const [tab, setTab] = useState<"decision" | "heatmap" | "blockers" | "insights">("decision");

  if (!workspace) return null;

  const activeFilters =
    fnFilter.size + quadFilter.size + sevFilter.size +
    (govOnly ? 1 : 0) +
    (priorityRange[0] !== 0 || priorityRange[1] !== 100 ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_2fr]">
        <div className="card flex flex-col justify-between bg-gradient-to-br from-paper to-chalk/40">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-terracotta" />
              <p className="eyebrow-muted">RECOMMENDED NEXT</p>
            </div>
            <h3 className="mt-2 font-display text-[22px] leading-tight text-navy">
              {recommendation.title}
            </h3>
            <p className="mt-2 text-[13px] text-graphite">{recommendation.body}</p>
          </div>
          <Button
            variant="outline"
            className="mt-4 self-start"
            onClick={() => setTab(recommendation.tab)}
          >
            {recommendation.cta} <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiTile label="Ready" value={kpis.ready} hint="Start-now · no constraint" icon={CheckCircle2} tone="text-emerald-600" />
          <KpiTile label="Needs design" value={kpis.needsDesign} hint="Plan quadrant" icon={ShieldAlert} tone="text-amber-600" />
          <KpiTile label="Blocked" value={kpis.blocked} hint="Hard stops" icon={AlertOctagon} tone="text-rose-600" />
          <KpiTile label="Watch" value={kpis.watch} hint="Watch items" icon={Eye} tone="text-slate-600" />
          <KpiTile label="Avg priority" value={kpis.avg} hint="0–100" icon={TrendingUp} />
        </div>
      </section>

      {/* FILTER BAR */}
      <section className="card !p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-graphite" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search use cases…"
              className="h-9 pl-8 text-[13px]"
            />
          </div>

          <MultiFilter
            label="Function"
            options={functions.map((f) => ({ value: f, label: f }))}
            selected={fnFilter}
            onChange={setFnFilter}
          />
          <MultiFilter
            label="Quadrant"
            options={QUADRANTS.map((q) => ({ value: q.k, label: q.label }))}
            selected={quadFilter}
            onChange={(s) => setQuadFilter(s as Set<string>)}
          />
          <MultiFilter
            label="Severity"
            options={(["hard_stop", "design_constraint", "watch_item"] as Sev[]).map((s) => ({
              value: s,
              label: SEV_LABEL[s],
            }))}
            selected={sevFilter as Set<string>}
            onChange={(s) => setSevFilter(s as Set<Sev>)}
          />

          <div className="flex items-center gap-2 rounded-md border border-chalk px-3 py-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">Priority</span>
            <span className="text-[11px] tabular-nums text-graphite w-[58px]">
              {priorityRange[0]}–{priorityRange[1]}
            </span>
            <div className="w-[100px]">
              <Slider
                min={0} max={100} step={5}
                value={priorityRange}
                onValueChange={(v) => setPriorityRange([v[0], v[1]] as [number, number])}
              />
            </div>
          </div>

          <Button
            variant={govOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setGovOnly((v) => !v)}
            className="h-9"
          >
            <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Governance flagged
          </Button>

          {(activeFilters > 0 || chip) && (
            <Button
              variant="ghost" size="sm"
              onClick={() => {
                setFnFilter(new Set()); setQuadFilter(new Set()); setSevFilter(new Set());
                setPriorityRange([0, 100]); setGovOnly(false); setChip(null);
              }}
            >
              Clear ({activeFilters + (chip ? 1 : 0)})
            </Button>
          )}

          <span className="ml-auto text-[11px] text-graphite">
            <FilterIcon className="inline h-3 w-3 mr-1" />
            {rows.length} of {allRows.length}
          </span>
        </div>

        {/* Quick-view chips */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-2 border-t border-chalk">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate mr-1">
            Quick view
          </span>
          {QUICK_CHIPS.map((c) => {
            const n = allRows.filter((r) => matchesChip(r, c.k)).length;
            const active = chip === c.k;
            return (
              <button
                key={c.k}
                onClick={() => setChip(active ? null : c.k)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition",
                  active
                    ? "bg-navy text-paper border-navy"
                    : cn("bg-paper hover:bg-chalk/40", c.tone),
                )}
              >
                {c.label}
                <span className={cn(
                  "font-mono tabular-nums text-[10px]",
                  active ? "text-paper/80" : "text-graphite",
                )}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* TABS */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="decision">Decision board</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="blockers">
            Blockers
            {kpis.blocked > 0 && (
              <Badge className="ml-2 bg-rose-100 text-rose-900 hover:bg-rose-100">{kpis.blocked}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="decision" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-graphite">
              {boardMode === "quadrants"
                ? "Grouped by scoring quadrant (priority × readiness)."
                : "Grouped by recommended next action — cascade considers hard stops, governance, then priority × readiness."}
            </p>
            <div className="inline-flex rounded-md border border-chalk overflow-hidden">
              <button
                onClick={() => setBoardMode("quadrants")}
                className={cn(
                  "px-3 py-1 text-[12px]",
                  boardMode === "quadrants" ? "bg-navy text-paper" : "bg-paper text-navy hover:bg-chalk/40",
                )}
              >
                Quadrants
              </button>
              <button
                onClick={() => setBoardMode("buckets")}
                className={cn(
                  "px-3 py-1 text-[12px] border-l border-chalk",
                  boardMode === "buckets" ? "bg-navy text-paper" : "bg-paper text-navy hover:bg-chalk/40",
                )}
              >
                Decision buckets
              </button>
            </div>
          </div>
          {boardMode === "quadrants" ? (
            <DecisionBoard rows={rows} onSelect={setSelected} govByUc={govByUc} />
          ) : (
            <BucketBoard rows={rows} onSelect={setSelected} govByUc={govByUc} />
          )}
        </TabsContent>

        <TabsContent value="heatmap" className="mt-4">
          <Heatmap rows={rows} onSelect={setSelected} />
        </TabsContent>

        <TabsContent value="blockers" className="mt-4">
          <BlockerPanel rows={rows} onSelect={setSelected} />
        </TabsContent>

        <TabsContent value="insights" className="mt-4">
          <InsightsPanel
            rows={rows}
            approvals={approvals}
            govFlagCount={govFlags.length}
            workspaceSlug={workspace.slug}
          />
        </TabsContent>
      </Tabs>

      {/* DETAIL DRAWER */}
      <UseCaseDrawer
        row={selected}
        onClose={() => setSelected(null)}
        workspaceSlug={workspace.slug}
        govCount={selected ? govByUc.get(selected.uc.id) ?? 0 : 0}
      />
    </div>
  );
}

// ============================================================================
// Filter dropdown
// ============================================================================
function MultiFilter({ label, options, selected, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          {label}
          {selected.size > 0 && (
            <Badge className="ml-2 bg-navy text-paper hover:bg-navy">{selected.size}</Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.length === 0 && (
          <div className="px-2 py-1.5 text-[12px] text-graphite">No options</div>
        )}
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={selected.has(o.value)}
            onCheckedChange={(checked) => {
              const next = new Set(selected);
              if (checked) next.add(o.value); else next.delete(o.value);
              onChange(next);
            }}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Decision board
// ============================================================================
function DecisionBoard({
  rows, onSelect, govByUc,
}: {
  rows: Row[];
  onSelect: (r: Row) => void;
  govByUc: Map<string, number>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {QUADRANTS.map((q) => {
        const items = rows
          .filter((r) => r.quadrant === q.k)
          .sort((a, b) => b.priority - a.priority);
        return (
          <div key={q.k} className={cn("rounded-lg border p-3 min-h-[220px]", q.tone)}>
            <div className="flex items-baseline justify-between">
              <p className="font-display text-[15px] text-navy">{q.label}</p>
              <span className="font-mono text-[11px] text-slate">{items.length}</span>
            </div>
            <p className="text-[11px] text-graphite">{q.desc}</p>
            <div className="mt-3 space-y-2">
              {items.length === 0 && (
                <p className="text-[12px] italic text-graphite">Empty</p>
              )}
              {items.map((r) => (
                <button
                  key={r.uc.id}
                  onClick={() => onSelect(r)}
                  className="w-full rounded-md border border-chalk bg-paper p-2.5 text-left transition hover:border-terracotta hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-[13px] font-medium text-navy">{r.uc.name}</p>
                    <span className="font-mono text-[12px] tabular-nums text-navy">
                      {Math.round(r.priority)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-graphite">{r.uc.function}</p>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <MetricMini label="Imp" value={r.impact} tone="bg-emerald-500" />
                    <MetricMini label="Rdy" value={r.readiness} tone="bg-blue-500" />
                    <MetricMini label="Risk" value={r.risk} tone="bg-rose-500" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {r.topSev && (
                      <span className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px] font-medium",
                        SEV_TONE[r.topSev],
                      )}>
                        {SEV_LABEL[r.topSev]}
                      </span>
                    )}
                    {(govByUc.get(r.uc.id) ?? 0) > 0 && (
                      <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                        Gov ({govByUc.get(r.uc.id)})
                      </span>
                    )}
                    {r.classification !== "—" && (
                      <span className="ml-auto text-[10px] text-graphite">{r.classification}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricMini({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-wide text-slate">{label}</span>
        <span className="font-mono text-[10px] tabular-nums text-graphite">{Math.round(value)}</span>
      </div>
      <MiniBar value={value} tone={tone} />
    </div>
  );
}

// ============================================================================
// Bucket board — collapses quadrant + governance + reason codes into a single
// recommended next action per use case.
// ============================================================================
function BucketBoard({
  rows, onSelect, govByUc,
}: {
  rows: Row[];
  onSelect: (r: Row) => void;
  govByUc: Map<string, number>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {BUCKET_ORDER.map((b) => {
        const meta = BUCKET_META[b];
        const items = rows
          .filter((r) => r.bucket === b)
          .sort((a, b) => b.priority - a.priority);
        return (
          <div key={b} className={cn("rounded-lg border p-3 min-h-[220px]", meta.tone)}>
            <div className="flex items-baseline justify-between">
              <p className="font-display text-[15px] text-navy">{meta.label}</p>
              <span className="font-mono text-[11px] text-slate">{items.length}</span>
            </div>
            <p className="text-[11px] text-graphite">{meta.desc}</p>
            <div className="mt-3 space-y-2">
              {items.length === 0 && (
                <p className="text-[12px] italic text-graphite">Empty</p>
              )}
              {items.map((r) => (
                <button
                  key={r.uc.id}
                  onClick={() => onSelect(r)}
                  className="w-full rounded-md border border-chalk bg-paper p-2.5 text-left transition hover:border-terracotta hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-[13px] font-medium text-navy">{r.uc.name}</p>
                    <span className="font-mono text-[12px] tabular-nums text-navy">
                      {Math.round(r.priority)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-graphite">
                    {r.uc.function} · {r.classification}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <MetricMini label="Imp" value={r.impact} tone="bg-emerald-500" />
                    <MetricMini label="Rdy" value={r.readiness} tone="bg-blue-500" />
                    <MetricMini label="Risk" value={r.risk} tone="bg-rose-500" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {r.topSev && (
                      <span className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px] font-medium",
                        SEV_TONE[r.topSev],
                      )}>
                        {SEV_LABEL[r.topSev]}
                      </span>
                    )}
                    {(govByUc.get(r.uc.id) ?? 0) > 0 && (
                      <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                        Gov ({govByUc.get(r.uc.id)})
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}



// ============================================================================
// Heatmap — SVG scatter (readiness X, priority Y)
// ============================================================================
function Heatmap({ rows, onSelect }: { rows: Row[]; onSelect: (r: Row) => void }) {
  const W = 720, H = 460, PAD = 40;
  const T = 60; // quadrant threshold
  const x = (v: number) => PAD + ((W - 2 * PAD) * v) / 100;
  const y = (v: number) => H - PAD - ((H - 2 * PAD) * v) / 100;

  return (
    <div className="card">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <p className="eyebrow-muted">PORTFOLIO HEATMAP</p>
          <h3 className="mt-1 font-display text-[18px] text-navy">Priority × Delivery readiness</h3>
        </div>
        <Legend />
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-full" role="img">
          {/* Quadrant fills */}
          <rect x={x(T)} y={y(100)} width={x(100) - x(T)} height={y(T) - y(100)} fill="rgb(16 185 129 / 0.06)" />
          <rect x={PAD} y={y(100)} width={x(T) - PAD} height={y(T) - y(100)} fill="rgb(245 158 11 / 0.06)" />
          <rect x={x(T)} y={y(T)} width={x(100) - x(T)} height={y(0) - y(T)} fill="rgb(59 130 246 / 0.06)" />
          <rect x={PAD} y={y(T)} width={x(T) - PAD} height={y(0) - y(T)} fill="rgb(100 116 139 / 0.04)" />

          {/* Axes */}
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#e5e7eb" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#e5e7eb" />
          {/* Threshold lines */}
          <line x1={x(T)} y1={PAD} x2={x(T)} y2={H - PAD} stroke="#cbd5e1" strokeDasharray="4 4" />
          <line x1={PAD} y1={y(T)} x2={W - PAD} y2={y(T)} stroke="#cbd5e1" strokeDasharray="4 4" />

          {/* Quadrant labels */}
          <text x={x(80)} y={y(95)} className="fill-emerald-700" fontSize="11" fontFamily="monospace">START NOW</text>
          <text x={x(5)} y={y(95)} className="fill-amber-700" fontSize="11" fontFamily="monospace">PLAN</text>
          <text x={x(80)} y={y(5) + 4} className="fill-blue-700" fontSize="11" fontFamily="monospace">RESHAPE</text>
          <text x={x(5)} y={y(5) + 4} className="fill-slate-500" fontSize="11" fontFamily="monospace">PARK</text>

          {/* Axis labels */}
          <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="11" className="fill-slate-600">Delivery readiness →</text>
          <text x={12} y={H / 2} textAnchor="middle" fontSize="11" className="fill-slate-600" transform={`rotate(-90 12 ${H / 2})`}>Priority →</text>

          {/* Points */}
          {rows.map((r) => {
            const sev = r.topSev ?? "watch_item";
            const radius = 4 + (r.impact / 100) * 8;
            return (
              <g key={r.uc.id} className="cursor-pointer" onClick={() => onSelect(r)}>
                <circle
                  cx={x(r.readiness)} cy={y(r.priority)} r={radius}
                  className={cn(SEV_DOT[sev], r.topSev === null && "fill-emerald-500")}
                  stroke="white" strokeWidth="1.5"
                  opacity={0.85}
                >
                  <title>{`${r.uc.name}\nPriority ${Math.round(r.priority)} · Readiness ${Math.round(r.readiness)} · Impact ${Math.round(r.impact)}`}</title>
                </circle>
              </g>
            );
          })}
          {rows.length === 0 && (
            <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" className="fill-slate-400">
              No scored use cases match these filters
            </text>
          )}
        </svg>
      </div>

      <p className="mt-2 text-[11px] text-graphite">
        Dot size encodes <strong>business impact</strong>. Color encodes worst <strong>severity</strong>.
        Click any dot to inspect.
      </p>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-graphite">
      {(["hard_stop", "design_constraint", "watch_item"] as Sev[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <svg width="10" height="10"><circle cx="5" cy="5" r="4" className={SEV_DOT[s]} /></svg>
          {SEV_LABEL[s]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <svg width="10" height="10"><circle cx="5" cy="5" r="4" className="fill-emerald-500" /></svg>
        Clean
      </span>
    </div>
  );
}

// ============================================================================
// Blocker panel
// ============================================================================
function BlockerPanel({ rows, onSelect }: { rows: Row[]; onSelect: (r: Row) => void }) {
  const grouped = useMemo(() => {
    const g: Record<Sev, Map<string, Row[]>> = {
      hard_stop: new Map(),
      design_constraint: new Map(),
      watch_item: new Map(),
    };
    rows.forEach((r) => {
      r.reasonCodes.forEach((code) => {
        const sev = sevOf(code);
        const list = g[sev].get(code) ?? [];
        list.push(r);
        g[sev].set(code, list);
      });
    });
    return g;
  }, [rows]);

  const order: Sev[] = ["hard_stop", "design_constraint", "watch_item"];
  const hasAny = order.some((s) => grouped[s].size > 0);

  if (!hasAny) {
    return (
      <div className="card text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
        <p className="mt-2 font-display text-[16px] text-navy">No blockers in scope</p>
        <p className="text-[12px] text-graphite">Either nothing scored yet, or your filters hide them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {order.map((sev) => {
        const codes = Array.from(grouped[sev].entries()).sort((a, b) => b[1].length - a[1].length);
        if (codes.length === 0) return null;
        return (
          <div key={sev} className="card">
            <div className="flex items-center gap-2">
              <span className={cn("rounded border px-2 py-0.5 text-[10px] font-medium", SEV_TONE[sev])}>
                {SEV_LABEL[sev]}
              </span>
              <p className="font-display text-[15px] text-navy">{codes.length} distinct code{codes.length > 1 ? "s" : ""}</p>
            </div>
            <ul className="mt-3 divide-y divide-chalk">
              {codes.map(([code, list]) => (
                <li key={code} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-medium text-navy">
                        {REASON_LABELS[code] ?? code}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-slate">{code}</p>
                    </div>
                    <Badge variant="outline">{list.length}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {list.map((r) => (
                      <button
                        key={r.uc.id}
                        onClick={() => onSelect(r)}
                        className="rounded border border-chalk bg-paper px-2 py-0.5 text-[11px] text-navy hover:border-terracotta"
                      >
                        {r.uc.name}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Insights
// ============================================================================
function InsightsPanel({
  rows, approvals, govFlagCount, workspaceSlug,
}: {
  rows: Row[];
  approvals: { decision: string }[];
  govFlagCount: number;
  workspaceSlug: string;
}) {
  const pillarAvgs = useMemo(() => {
    if (rows.length === 0) return null;
    const sum = { impact: 0, feasibility: 0, maturity: 0, risk: 0, ai: 0, agent: 0 };
    rows.forEach((r) => {
      const s = r.score;
      sum.impact += Number(s?.business_impact ?? 0);
      sum.feasibility += Number(s?.feasibility ?? 0);
      sum.maturity += Number(s?.process_maturity ?? 0);
      sum.risk += Number(s?.risk ?? 0);
      sum.ai += Number(s?.ai_suitability ?? 0);
      sum.agent += Number(s?.agent_suitability ?? 0);
    });
    const n = rows.length;
    return [
      { k: "Business impact", v: Math.round(sum.impact / n), tone: "bg-emerald-500" },
      { k: "Feasibility", v: Math.round(sum.feasibility / n), tone: "bg-blue-500" },
      { k: "Process maturity", v: Math.round(sum.maturity / n), tone: "bg-violet-500" },
      { k: "Risk", v: Math.round(sum.risk / n), tone: "bg-rose-500" },
      { k: "AI suitability", v: Math.round(sum.ai / n), tone: "bg-amber-500" },
      { k: "Agent suitability", v: Math.round(sum.agent / n), tone: "bg-terracotta" },
    ];
  }, [rows]);

  const classMix = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.classification, (m.get(r.classification) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const gateRate = useMemo(() => {
    const scored = rows.filter((r) => r.score);
    if (scored.length === 0) return { g1: 0, g2: 0 };
    const g1 = scored.filter((r) => r.gateStatuses?.gate_1?.status === "PASS").length;
    const g2 = scored.filter((r) => r.gateStatuses?.gate_2?.status === "PASS").length;
    return {
      g1: Math.round((g1 / scored.length) * 100),
      g2: Math.round((g2 / scored.length) * 100),
    };
  }, [rows]);

  const topPriority = useMemo(
    () => [...rows].sort((a, b) => b.priority - a.priority).slice(0, 5),
    [rows],
  );

  const stalled = useMemo(() => {
    const TWO_WEEKS = 14 * 24 * 3600 * 1000;
    return rows.filter(
      (r) =>
        r.score?.scored_at &&
        Date.now() - new Date(r.score.scored_at).getTime() > TWO_WEEKS &&
        !["submitted", "approved", "rejected"].includes(r.uc.status),
    );
  }, [rows]);

  const pendingApprovals = approvals.filter((a) => a.decision === "pending").length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card">
        <p className="eyebrow-muted">PILLAR AVERAGES</p>
        <h3 className="mt-1 font-display text-[16px] text-navy">Portfolio strengths & weaknesses</h3>
        {pillarAvgs ? (
          <div className="mt-3 space-y-2.5">
            {pillarAvgs.map((p) => (
              <div key={p.k}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-graphite">{p.k}</span>
                  <span className="font-mono tabular-nums text-navy">{p.v}</span>
                </div>
                <MiniBar value={p.v} tone={p.tone} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-graphite">Score use cases to populate.</p>
        )}
      </div>

      <div className="card">
        <p className="eyebrow-muted">CLASSIFICATION MIX</p>
        <h3 className="mt-1 font-display text-[16px] text-navy">Automation vs AI shape</h3>
        {classMix.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {classMix.map(([k, n]) => (
              <li key={k} className="flex items-center justify-between rounded border border-chalk bg-paper px-2.5 py-1.5">
                <span className="text-[13px] text-navy">{k}</span>
                <Badge variant="outline">{n}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-graphite">No classifications yet.</p>
        )}
      </div>

      <div className="card">
        <p className="eyebrow-muted">GATES & GOVERNANCE</p>
        <h3 className="mt-1 font-display text-[16px] text-navy">Pass rate · open flags</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded border border-chalk p-3">
            <p className="font-mono text-[10px] uppercase tracking-wide text-slate">Gate 1 PASS</p>
            <p className="mt-1 font-display text-[22px] text-navy">{gateRate.g1}%</p>
            <MiniBar value={gateRate.g1} tone="bg-emerald-500" />
          </div>
          <div className="rounded border border-chalk p-3">
            <p className="font-mono text-[10px] uppercase tracking-wide text-slate">Gate 2 PASS</p>
            <p className="mt-1 font-display text-[22px] text-navy">{gateRate.g2}%</p>
            <MiniBar value={gateRate.g2} tone="bg-blue-500" />
          </div>
          <div className="rounded border border-chalk p-3 col-span-2 flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-slate">Governance flags</p>
              <p className="mt-1 font-display text-[22px] text-navy">{govFlagCount}</p>
            </div>
            <Link
              to="/app/$workspaceSlug/scale/governance"
              params={{ workspaceSlug }}
              className="text-[12px] text-terracotta hover:underline inline-flex items-center"
            >
              Open <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow-muted">TOP PRIORITY</p>
        <h3 className="mt-1 font-display text-[16px] text-navy">Lead candidates</h3>
        {topPriority.length === 0 ? (
          <p className="mt-3 text-[13px] text-graphite">No scored use cases.</p>
        ) : (
          <ul className="mt-3 divide-y divide-chalk">
            {topPriority.map((r) => (
              <li key={r.uc.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-[13px] font-medium text-navy">{r.uc.name}</p>
                  <p className="text-[11px] text-graphite">{r.uc.function} · {r.classification}</p>
                </div>
                <span className="font-mono text-[14px] tabular-nums text-navy">{Math.round(r.priority)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card lg:col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow-muted">ATTENTION</p>
            <h3 className="mt-1 font-display text-[16px] text-navy">
              {stalled.length} stalled · {pendingApprovals} pending approval
            </h3>
          </div>
          <Activity className="h-5 w-5 text-graphite" />
        </div>
        {stalled.length === 0 ? (
          <p className="mt-2 text-[12px] text-graphite">Nothing scored over 14 days without progress.</p>
        ) : (
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {stalled.slice(0, 8).map((r) => (
              <li key={r.uc.id} className="flex items-center justify-between rounded border border-chalk bg-paper px-2.5 py-1.5">
                <span className="truncate text-[13px] text-navy">{r.uc.name}</span>
                <span className="font-mono text-[10px] text-slate">{r.uc.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Use case detail drawer
// ============================================================================
function UseCaseDrawer({
  row, onClose, workspaceSlug, govCount,
}: {
  row: Row | null;
  onClose: () => void;
  workspaceSlug: string;
  govCount: number;
}) {
  const navigate = useNavigate();
  const open = !!row;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display text-[18px] text-navy">{row.uc.name}</SheetTitle>
              <p className="text-[12px] text-graphite">
                {row.uc.function} · {row.classification}
              </p>
              <span className={cn(
                "mt-2 inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                BUCKET_META[row.bucket].chip,
              )}>
                {BUCKET_META[row.bucket].label}
              </span>
            </SheetHeader>

            <div className="mt-5 space-y-5">
              <section className="grid grid-cols-3 gap-2">
                <ScoreBox label="Priority" value={row.priority} tone="text-navy" />
                <ScoreBox label="Readiness" value={row.readiness} tone="text-blue-700" />
                <ScoreBox label="Impact" value={row.impact} tone="text-emerald-700" />
              </section>

              <RecommendedActionsSection
                actions={recommendedActions({
                  reasonCodes: row.reasonCodes,
                  gateStatuses: row.gateStatuses,
                  govCount,
                })}
              />


              <section>
                <p className="eyebrow-muted">PILLARS</p>
                <div className="mt-2 space-y-2">
                  {[
                    ["Business impact", row.score?.business_impact, "bg-emerald-500"],
                    ["Feasibility", row.score?.feasibility, "bg-blue-500"],
                    ["Process maturity", row.score?.process_maturity, "bg-violet-500"],
                    ["Risk", row.score?.risk, "bg-rose-500"],
                    ["AI suitability", row.score?.ai_suitability, "bg-amber-500"],
                    ["Agent suitability", row.score?.agent_suitability, "bg-terracotta"],
                  ].map(([k, v, tone]) => (
                    <div key={k as string}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-graphite">{k as string}</span>
                        <span className="font-mono tabular-nums text-navy">{Math.round(Number(v ?? 0))}</span>
                      </div>
                      <MiniBar value={Number(v ?? 0)} tone={tone as string} />
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <p className="eyebrow-muted">REASON CODES</p>
                {row.reasonCodes.length === 0 ? (
                  <p className="mt-2 text-[12px] text-graphite">None — clean.</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {(["hard_stop", "design_constraint", "watch_item"] as Sev[]).map((sev) => {
                      const codes = row.reasonCodes.filter((c) => sevOf(c) === sev);
                      if (codes.length === 0) return null;
                      return (
                        <div key={sev}>
                          <p className={cn("inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium mb-1", SEV_TONE[sev])}>
                            {SEV_LABEL[sev]}
                          </p>
                          <ul className="space-y-1">
                            {codes.map((c) => (
                              <li key={c} className="text-[12px] text-navy">
                                · {REASON_LABELS[c] ?? c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <p className="eyebrow-muted">GATES</p>
                <ul className="mt-2 space-y-1.5">
                  {(["gate_1", "gate_2", "gate_3"] as const).map((g) => {
                    const status = row.gateStatuses?.[g]?.status ?? "NOT_ASSESSED";
                    return (
                      <li key={g} className="flex items-center justify-between rounded border border-chalk bg-paper px-2.5 py-1.5 text-[12px]">
                        <span className="text-navy">{g.toUpperCase().replace("_", " ")}</span>
                        <span
                          className={cn(
                            "font-mono text-[10px] uppercase",
                            status === "PASS" && "text-emerald-700",
                            status === "FAIL" && "text-rose-700",
                            status === "NOT_ASSESSED" && "text-slate-500",
                          )}
                        >
                          {status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {govCount > 0 && (
                <section className="rounded border border-amber-200 bg-amber-50 p-2.5">
                  <p className="text-[12px] text-amber-900">
                    <ShieldAlert className="inline h-3.5 w-3.5 mr-1" />
                    {govCount} governance flag{govCount > 1 ? "s" : ""} open
                  </p>
                </section>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    navigate({
                      to: "/app/$workspaceSlug/build/capture/$useCaseId",
                      params: { workspaceSlug, useCaseId: row.uc.id },
                    });
                    onClose();
                  }}
                >
                  Open use case <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const ACTION_PRIORITY_TONE: Record<RecommendedAction["priority"], string> = {
  now:   "bg-rose-100 text-rose-900 border-rose-200",
  soon:  "bg-amber-100 text-amber-900 border-amber-200",
  later: "bg-slate-100 text-slate-700 border-slate-200",
};

function RecommendedActionsSection({ actions }: { actions: RecommendedAction[] }) {
  return (
    <section>
      <p className="eyebrow-muted">RECOMMENDED ACTIONS</p>
      {actions.length === 0 ? (
        <p className="mt-2 text-[12px] text-graphite">
          No outstanding actions — ready to advance.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {actions.map((a) => (
            <li
              key={a.id}
              className="rounded border border-chalk bg-paper px-2.5 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium text-navy leading-snug">{a.label}</p>
                <span className={cn(
                  "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  ACTION_PRIORITY_TONE[a.priority],
                )}>
                  {a.priority}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-graphite">{a.why}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ScoreBox({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded border border-chalk bg-paper p-2.5 text-center">
      <p className="font-mono text-[9px] uppercase tracking-wide text-slate">{label}</p>
      <p className={cn("mt-0.5 font-display text-[20px]", tone)}>{Math.round(value)}</p>
    </div>
  );
}
