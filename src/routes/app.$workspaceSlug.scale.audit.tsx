import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/$workspaceSlug/scale/audit")({
  component: AuditPage,
});

const ACTION_LABEL: Record<string, string> = {
  roadmap_added: "Roadmap entry added",
  roadmap_stage_changed: "Roadmap stage changed",
  roadmap_transition_blocked: "Roadmap transition blocked",
  governance_flag_created: "Governance flag created",
  governance_flag_assigned: "Governance flag assigned",
  governance_flag_status_changed: "Governance flag status changed",
  governance_flag_notes_updated: "Governance flag notes updated",
  post_pilot_review_submitted: "Pilot review submitted",
};

const ENTITY_LABEL: Record<string, string> = {
  roadmap_entry: "Roadmap entry",
  governance_flag: "Governance flag",
  post_pilot_review: "Pilot review",
  use_case: "Use case",
};

type DateRange = "all" | "7d" | "30d" | "custom";

interface AuditRow {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  actor_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
}

function AuditPage() {
  const { workspace, isAdmin } = useWorkspace();
  const { workspaceSlug } = Route.useParams();

  const [action, setAction] = useState<string>("");
  const [entity, setEntity] = useState<string>("");
  const [actor, setActor] = useState<string>("");
  const [range, setRange] = useState<DateRange>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit_log_full", workspace?.id, isAdmin],
    enabled: !!workspace,
    queryFn: async (): Promise<AuditRow[]> => {
      if (isAdmin) {
        // Admins fetch full rows (including before_state/after_state) via the
        // SECURITY DEFINER RPC; direct column SELECT is revoked for those cols.
        const { data, error } = await supabase.rpc("get_audit_log_with_diffs", {
          p_workspace_id: workspace!.id,
          p_limit: 500,
        });
        if (error) throw error;
        return (data ?? []) as unknown as AuditRow[];
      }
      // Members only see the safe columns.
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, action_type, entity_type, entity_id, entity_label, actor_id, created_at, metadata")
        .eq("workspace_id", workspace!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...(r as Omit<AuditRow, "before_state" | "after_state">),
        before_state: null,
        after_state: null,
      }));
    },
  });

  const actorIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[],
    [rows],
  );

  const { data: actors = [] } = useQuery({
    queryKey: ["audit_log_actors", workspace?.id, actorIds.join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", actorIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const actorMap = useMemo(() => {
    const m = new Map<string, { user_id: string; full_name: string | null; avatar_url: string | null }>();
    for (const a of actors) m.set(a.user_id, a);
    return m;
  }, [actors]);

  const filtered = useMemo(() => {
    let cutoffFrom: number | null = null;
    let cutoffTo: number | null = null;
    if (range === "7d") cutoffFrom = Date.now() - 7 * 24 * 3600 * 1000;
    else if (range === "30d") cutoffFrom = Date.now() - 30 * 24 * 3600 * 1000;
    else if (range === "custom") {
      if (from) cutoffFrom = new Date(from).getTime();
      if (to) cutoffTo = new Date(to).getTime() + 24 * 3600 * 1000 - 1;
    }
    return rows.filter((r) => {
      if (action && r.action_type !== action) return false;
      if (entity && r.entity_type !== entity) return false;
      if (actor && r.actor_id !== actor) return false;
      const t = new Date(r.created_at).getTime();
      if (cutoffFrom != null && t < cutoffFrom) return false;
      if (cutoffTo != null && t > cutoffTo) return false;
      return true;
    });
  }, [rows, action, entity, actor, range, from, to]);

  const actionTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action_type))).sort(),
    [rows],
  );
  const entityTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.entity_type))).sort(),
    [rows],
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadCsv = () => {
    const headers = ["created_at", "actor", "action_type", "entity_type", "entity_label", "entity_id", "metadata"];
    if (isAdmin) headers.push("before_state", "after_state");
    const lines = [headers.join(",")];
    for (const r of filtered) {
      const actorLabel = r.actor_id
        ? actorMap.get(r.actor_id)?.full_name ?? r.actor_id
        : "system";
      const cells = [
        r.created_at,
        actorLabel,
        r.action_type,
        r.entity_type,
        r.entity_label ?? "",
        r.entity_id ?? "",
        JSON.stringify(r.metadata ?? {}),
      ];
      if (isAdmin) {
        cells.push(JSON.stringify(r.before_state ?? null), JSON.stringify(r.after_state ?? null));
      }
      lines.push(cells.map(csvEscape).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${workspace?.slug ?? "workspace"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!workspace) return null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">SCALE · AUDIT LOG</p>
          <h1 className="h-display-sm mt-1">Audit trail.</h1>
          <p className="text-[13px] text-graphite mt-1">
            Review the decision trail behind roadmap, governance, and pilot-review activity.
          </p>
        </div>
        <button
          onClick={downloadCsv}
          disabled={filtered.length === 0}
          className="rounded-full border border-chalk bg-paper px-3 py-1.5 text-[12px] font-medium text-navy hover:bg-mist disabled:opacity-50"
        >
          Download CSV ({filtered.length})
        </button>
      </header>

      <div className="card flex flex-wrap gap-2 items-end">
        <FilterSelect label="Action" value={action} onChange={setAction} options={actionTypes} labelMap={ACTION_LABEL} />
        <FilterSelect label="Entity" value={entity} onChange={setEntity} options={entityTypes} labelMap={ENTITY_LABEL} />
        <FilterSelect
          label="Actor"
          value={actor}
          onChange={setActor}
          options={actorIds}
          labelMap={Object.fromEntries(
            actors.map((a) => [a.user_id, a.full_name ?? a.user_id.slice(0, 8)]),
          )}
        />
        <label className="flex flex-col text-[11px] text-graphite">
          <span className="font-medium text-navy">Date range</span>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as DateRange)}
            className="mt-1 rounded border border-chalk bg-paper px-2 py-1 text-[12px] text-navy"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {range === "custom" && (
          <>
            <label className="flex flex-col text-[11px] text-graphite">
              <span className="font-medium text-navy">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 rounded border border-chalk bg-paper px-2 py-1 text-[12px] text-navy"
              />
            </label>
            <label className="flex flex-col text-[11px] text-graphite">
              <span className="font-medium text-navy">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 rounded border border-chalk bg-paper px-2 py-1 text-[12px] text-navy"
              />
            </label>
          </>
        )}
        {(action || entity || actor || range !== "all") && (
          <button
            onClick={() => {
              setAction(""); setEntity(""); setActor(""); setRange("all"); setFrom(""); setTo("");
            }}
            className="text-[11px] text-graphite hover:text-navy underline ml-auto"
          >
            Reset
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-[12px] text-slate">Loading audit log…</p>
      ) : filtered.length === 0 ? (
        <div className="card">
          <p className="text-[13px] text-slate">No audit events match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <AuditRowCard
              key={r.id}
              row={r}
              actor={r.actor_id ? actorMap.get(r.actor_id) : undefined}
              expanded={expanded.has(r.id)}
              onToggle={() => toggle(r.id)}
              isAdmin={isAdmin}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  labelMap,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labelMap: Record<string, string>;
}) {
  return (
    <label className="flex flex-col text-[11px] text-graphite">
      <span className="font-medium text-navy">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded border border-chalk bg-paper px-2 py-1 text-[12px] text-navy min-w-[140px]"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labelMap[o] ?? o}
          </option>
        ))}
      </select>
    </label>
  );
}

function AuditRowCard({
  row,
  actor,
  expanded,
  onToggle,
  isAdmin,
  workspaceSlug,
}: {
  row: AuditRow;
  actor: { user_id: string; full_name: string | null; avatar_url: string | null } | undefined;
  expanded: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  workspaceSlug: string;
}) {
  const actionText = ACTION_LABEL[row.action_type] ?? row.action_type;
  const entityText = ENTITY_LABEL[row.entity_type] ?? row.entity_type;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const useCaseId = typeof meta.use_case_id === "string" ? meta.use_case_id : null;

  const relatedLink = (() => {
    if (row.entity_type === "roadmap_entry") {
      return { to: "/app/$workspaceSlug/scale/roadmap" as const, params: { workspaceSlug }, label: "Open roadmap" };
    }
    if (row.entity_type === "governance_flag") {
      return { to: "/app/$workspaceSlug/scale/governance" as const, params: { workspaceSlug }, label: "Open governance" };
    }
    if (row.entity_type === "post_pilot_review" && useCaseId) {
      return {
        to: "/app/$workspaceSlug/scale/$useCaseId/review" as const,
        params: { workspaceSlug, useCaseId },
        label: "Open review",
      };
    }
    return null;
  })();

  const summary = summarizeMetadata(row.action_type, meta);

  return (
    <div className="card space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {actor?.avatar_url ? (
            <img src={actor.avatar_url} alt="" className="h-7 w-7 rounded-full mt-0.5" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-mist text-[10px] font-medium text-navy grid place-items-center mt-0.5">
              {(actor?.full_name ?? row.actor_id ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-navy">
              {actionText}
              {row.entity_label && (
                <span className="text-graphite font-normal"> · {row.entity_label}</span>
              )}
            </p>
            <p className="text-[11px] text-slate">
              {actor?.full_name ?? (row.actor_id ? row.actor_id.slice(0, 8) : "System")} ·{" "}
              {entityText} ·{" "}
              {new Date(row.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {relatedLink && (
            <Link
              to={relatedLink.to}
              params={relatedLink.params}
              className="text-[11px] text-graphite hover:text-navy underline"
            >
              {relatedLink.label} →
            </Link>
          )}
          <button
            onClick={onToggle}
            className="text-[11px] text-graphite hover:text-navy underline"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {summary && <p className="text-[12px] text-graphite">{summary}</p>}

      {expanded && (
        <div className="space-y-2 border-t border-chalk pt-2">
          {Object.keys(meta).length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-navy mb-1">Metadata</p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                {Object.entries(meta).map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <dt className="text-slate">{k}:</dt>
                    <dd className="text-navy truncate">{formatValue(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {isAdmin && (row.before_state || row.after_state) && (
            <div className="grid gap-2 sm:grid-cols-2">
              <DiffBlock label="Before" data={row.before_state} />
              <DiffBlock label="After" data={row.after_state} />
            </div>
          )}

          {isAdmin && (
            <details className="text-[11px] text-slate">
              <summary className="cursor-pointer">Raw JSON (admin)</summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded bg-mist p-2 text-[10px]">
{JSON.stringify(
  { metadata: row.metadata, before_state: row.before_state, after_state: row.after_state },
  null,
  2,
)}
              </pre>
            </details>
          )}

          {!isAdmin && (row.before_state || row.after_state) && (
            <p className="text-[11px] text-slate italic">Before/after details are visible to workspace admins.</p>
          )}
        </div>
      )}
    </div>
  );
}

function DiffBlock({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <div className="rounded border border-chalk bg-mist/40 p-2">
      <p className="text-[10px] font-medium text-slate uppercase tracking-wide">{label}</p>
      <dl className="mt-1 space-y-0.5 text-[11px]">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex gap-1">
            <dt className="text-slate">{k}:</dt>
            <dd className="text-navy">{formatValue(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function summarizeMetadata(action: string, meta: Record<string, unknown>): string | null {
  if (action === "roadmap_stage_changed" && meta.from_stage && meta.to_stage) {
    return `${meta.from_stage} → ${meta.to_stage}${meta.reason ? ` · ${meta.reason}` : ""}`;
  }
  if (action === "roadmap_transition_blocked") {
    return `Attempted ${meta.attempted_from_stage} → ${meta.attempted_to_stage} · ${meta.reason ?? "blocked"}`;
  }
  if (action === "post_pilot_review_submitted") {
    return `Recommendation: ${meta.recommendation ?? "n/a"}${meta.accuracy_score != null ? ` · Accuracy ${meta.accuracy_score}%` : ""}`;
  }
  if (action === "governance_flag_status_changed") {
    return null;
  }
  return null;
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
