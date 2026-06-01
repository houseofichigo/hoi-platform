import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWorkspaceMemberProfiles } from "@/hooks/useScaleRoadmap";
import {
  governanceFlagsFullQO,
  governanceFlagAuditQO,
  type GovernanceFlagRow,
} from "@/lib/scale/queries";
import {
  updateGovernanceFlag,
  bulkMarkAdvisoryNotApplicable,
} from "@/lib/scale/scale.functions";

export const Route = createFileRoute("/app/$workspaceSlug/scale/governance")({
  component: GovernancePage,
});

// ---------- Static labels ----------

const SEVERITY_LABEL: Record<string, string> = {
  hard_stop: "Hard stop",
  requires_action: "Requires action",
  advisory: "Advisory",
};
const SEVERITY_TONE: Record<string, string> = {
  hard_stop: "bg-terracotta text-white",
  requires_action: "bg-navy text-white",
  advisory: "bg-mist text-navy",
};
const SEVERITY_ORDER: Record<string, number> = {
  hard_stop: 0,
  requires_action: 1,
  advisory: 2,
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  accepted_risk: "Accepted risk",
  not_applicable: "Not applicable",
};
const STATUS_TONE: Record<string, string> = {
  open: "bg-paper text-navy border-chalk",
  in_progress: "bg-mist text-navy border-chalk",
  resolved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  accepted_risk: "bg-amber-50 text-amber-800 border-amber-200",
  not_applicable: "bg-chalk text-slate border-chalk",
};

const SOURCE_LABEL: Record<string, string> = {
  eu_ai_act: "EU AI Act",
  gdpr: "GDPR",
  internal_policy: "Internal policy",
};

const RULE_EXPLANATION: Record<string, string> = {
  EU_AI_ACT_HIGH_RISK:
    "EU AI Act classifies this use case as high-risk based on its function and impact. Requires conformity assessment, technical documentation, and ongoing monitoring.",
  ARTICLE_11_DOCUMENTATION:
    "EU AI Act Article 11 requires complete technical documentation before the system is placed on the market.",
  HITL_REQUIRED_ART14:
    "EU AI Act Article 14 requires meaningful human oversight. A reviewer must be able to override or stop the system.",
  TRANSPARENCY_ART13:
    "EU AI Act Article 13 requires users to be informed they are interacting with an AI system and how it works.",
  CONFORMITY_ASSESSMENT:
    "A conformity assessment must be completed before deployment for high-risk systems.",
  DPIA_REQUIRED:
    "GDPR Article 35 requires a Data Protection Impact Assessment when personal data is combined with automated decisions or broad processing.",
  DATA_MINIMISATION:
    "GDPR Article 5 requires processing the minimum personal data needed. Review the data scope before scaling.",
  RIGHT_TO_EXPLANATION:
    "GDPR Article 22 requires meaningful explanations for automated decisions affecting individuals.",
  SECURITY_REVIEW_REQUIRED:
    "Internal policy requires a security review when foreign data access or multiple integrations are involved.",
  CHANGE_MANAGEMENT:
    "Internal change-management approval is required before production deployment.",
};

const STATUSES = ["open", "in_progress", "resolved", "accepted_risk", "not_applicable"] as const;
const SEVERITIES = ["hard_stop", "requires_action", "advisory"] as const;
const SOURCES = ["eu_ai_act", "gdpr", "internal_policy"] as const;

const ALLOWED_FLAG_TRANSITIONS: Record<string, string[]> = {
  open: ["in_progress", "resolved", "accepted_risk", "not_applicable"],
  in_progress: ["resolved", "accepted_risk", "not_applicable", "open"],
  resolved: ["in_progress"],
  accepted_risk: ["in_progress"],
  not_applicable: ["in_progress"],
};

// ---------- Page ----------

function GovernancePage() {
  const { workspace, isAdmin } = useWorkspace();
  const { data: flags = [], isLoading } = useQuery(governanceFlagsFullQO(workspace?.id));
  const { data: members = [] } = useWorkspaceMemberProfiles();
  const qc = useQueryClient();

  const memberById = useMemo(() => {
    const m = new Map<string, (typeof members)[number]>();
    for (const p of members) m.set(p.user_id, p);
    return m;
  }, [members]);

  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [useCaseFilter, setUseCaseFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"severity" | "created" | "updated">("severity");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const useCaseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of flags) if (f.use_cases) map.set(f.use_cases.id, f.use_cases.name);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [flags]);

  const filtered = useMemo(() => {
    const rows = flags.filter((f) => {
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (sourceFilter !== "all" && f.rule_source !== sourceFilter) return false;
      if (useCaseFilter !== "all" && f.use_case_id !== useCaseFilter) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "unassigned" && f.assignee_id) return false;
        if (assigneeFilter !== "unassigned" && f.assignee_id !== assigneeFilter) return false;
      }
      return true;
    });
    return rows.sort((a, b) => {
      if (sortBy === "severity") {
        const d = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
        if (d !== 0) return d;
        return b.created_at.localeCompare(a.created_at);
      }
      if (sortBy === "updated") return b.updated_at.localeCompare(a.updated_at);
      return b.created_at.localeCompare(a.created_at);
    });
  }, [flags, severityFilter, statusFilter, sourceFilter, useCaseFilter, assigneeFilter, sortBy]);

  const bulkCandidates = useMemo(
    () =>
      flags.filter(
        (f) => f.severity === "advisory" && (f.status === "open" || f.status === "in_progress"),
      ),
    [flags],
  );

  const bulkFn = useServerFn(bulkMarkAdvisoryNotApplicable);
  const bulk = useMutation({
    mutationFn: () => bulkFn({ data: { workspaceId: workspace!.id } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`Marked ${res.changed} advisory flag${res.changed === 1 ? "" : "s"} as not applicable`);
        qc.invalidateQueries({ queryKey: ["scale", "governance_flags_full", workspace?.id] });
        qc.invalidateQueries({ queryKey: ["scale", "governance_flags_summary", workspace?.id] });
        qc.invalidateQueries({ queryKey: ["scale", "audit_month_count", workspace?.id] });
      } else {
        toast.error("Only workspace admins can run this action");
      }
      setConfirmBulk(false);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Bulk update failed"),
  });

  if (!workspace) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">SCALE · GOVERNANCE</p>
          <h2 className="h-display-sm mt-1">
            Governance <em className="text-terracotta not-italic font-display italic">flags.</em>
          </h2>
          <p className="text-[13px] text-graphite mt-1">
            Track compliance, risk, and operating-policy flags across the deployment roadmap.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <span className="rounded-full border border-chalk bg-mist px-2 py-0.5 text-[11px] text-navy">
              Read-only
            </span>
          )}
          {isAdmin && (
            <button
              onClick={() => setConfirmBulk(true)}
              disabled={bulkCandidates.length === 0}
              className="rounded-full border border-chalk bg-paper px-3 py-1.5 text-[12px] text-navy hover:bg-mist disabled:opacity-50"
              title={
                bulkCandidates.length === 0
                  ? "No open/in-progress advisory flags"
                  : `Affects ${bulkCandidates.length} advisory flag(s)`
              }
            >
              Mark all advisory as not applicable
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Severity"
          value={severityFilter}
          onChange={setSeverityFilter}
          options={[{ value: "all", label: "All" }, ...SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABEL[s] }))]}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[{ value: "all", label: "All" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
        />
        <FilterSelect
          label="Rule source"
          value={sourceFilter}
          onChange={setSourceFilter}
          options={[{ value: "all", label: "All" }, ...SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))]}
        />
        <FilterSelect
          label="Use case"
          value={useCaseFilter}
          onChange={setUseCaseFilter}
          options={[{ value: "all", label: "All" }, ...useCaseOptions.map((u) => ({ value: u.id, label: u.name }))]}
        />
        <FilterSelect
          label="Assignee"
          value={assigneeFilter}
          onChange={setAssigneeFilter}
          options={[
            { value: "all", label: "All" },
            { value: "unassigned", label: "Unassigned" },
            ...members.map((m) => ({ value: m.user_id, label: m.full_name ?? "Member" })),
          ]}
        />
        <FilterSelect
          label="Sort"
          value={sortBy}
          onChange={(v) => setSortBy(v as typeof sortBy)}
          options={[
            { value: "severity", label: "Severity (hard stop first)" },
            { value: "created", label: "Created (newest)" },
            { value: "updated", label: "Updated (newest)" },
          ]}
        />
        <div className="ml-auto text-[11px] text-slate">
          {filtered.length} of {flags.length}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-[12px] text-slate">Loading flags…</p>
      ) : filtered.length === 0 ? (
        <div className="card">
          <p className="text-[13px] text-slate">
            {flags.length === 0
              ? "No governance flags yet. Flags are generated when a use case is approved in Build."
              : "No flags match the current filters."}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.9fr_0.9fr_1fr_0.7fr_0.7fr_28px] gap-3 border-b border-chalk bg-mist px-3 py-2 text-[10px] uppercase tracking-wide text-slate">
            <span>Use case</span>
            <span>Rule code</span>
            <span>Source</span>
            <span>Severity</span>
            <span>Status</span>
            <span>Assignee</span>
            <span>Created</span>
            <span>Updated</span>
            <span />
          </div>
          {filtered.map((f) => (
            <FlagRow
              key={f.id}
              flag={f}
              memberById={memberById}
              members={members}
              isAdmin={isAdmin}
              expanded={expanded === f.id}
              onToggle={() => setExpanded(expanded === f.id ? null : f.id)}
            />
          ))}
        </div>
      )}

      {confirmBulk && (
        <ConfirmModal
          title="Mark all advisory flags as not applicable?"
          body={`${bulkCandidates.length} open/in-progress advisory flag(s) will be marked not applicable with the note "Bulk marked as not applicable by admin." This is audited.`}
          confirmLabel={bulk.isPending ? "Working…" : "Confirm"}
          confirmDisabled={bulk.isPending}
          onConfirm={() => bulk.mutate()}
          onCancel={() => setConfirmBulk(false)}
        />
      )}
    </div>
  );
}

// ---------- Row ----------

function FlagRow({
  flag,
  memberById,
  members,
  isAdmin,
  expanded,
  onToggle,
}: {
  flag: GovernanceFlagRow;
  memberById: Map<string, { user_id: string; full_name: string | null; avatar_url: string | null }>;
  members: Array<{ user_id: string; full_name: string | null; avatar_url: string | null }>;
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const assignee = flag.assignee_id ? memberById.get(flag.assignee_id) : null;
  return (
    <div className="border-b border-chalk last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[1.4fr_1fr_0.8fr_0.9fr_0.9fr_1fr_0.7fr_0.7fr_28px] items-center gap-3 px-3 py-2 text-left text-[12px] text-navy hover:bg-mist"
      >
        <span className="truncate">{flag.use_cases?.name ?? "—"}</span>
        <span className="truncate font-mono text-[11px] text-graphite">{flag.rule_code}</span>
        <span className="truncate text-graphite">{SOURCE_LABEL[flag.rule_source] ?? flag.rule_source}</span>
        <span>
          <span className={["rounded-full px-2 py-0.5 text-[10px] font-medium", SEVERITY_TONE[flag.severity] ?? "bg-chalk text-navy"].join(" ")}>
            {SEVERITY_LABEL[flag.severity] ?? flag.severity}
          </span>
        </span>
        <span>
          <span className={["rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_TONE[flag.status] ?? "bg-chalk text-navy border-chalk"].join(" ")}>
            {STATUS_LABEL[flag.status] ?? flag.status}
          </span>
        </span>
        <span className="truncate text-graphite">
          {assignee?.full_name ?? (flag.assignee_id ? "Member" : "Unassigned")}
        </span>
        <span className="text-[11px] text-slate">{shortDate(flag.created_at)}</span>
        <span className="text-[11px] text-slate">{shortDate(flag.updated_at)}</span>
        <span className="text-slate text-[10px]">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <FlagDetail flag={flag} members={members} memberById={memberById} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function FlagDetail({
  flag,
  members,
  memberById,
  isAdmin,
}: {
  flag: GovernanceFlagRow;
  members: Array<{ user_id: string; full_name: string | null; avatar_url: string | null }>;
  memberById: Map<string, { user_id: string; full_name: string | null; avatar_url: string | null }>;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateGovernanceFlag);
  const [status, setStatus] = useState(flag.status);
  const [assigneeId, setAssigneeId] = useState<string>(flag.assignee_id ?? "");
  const [notes, setNotes] = useState(flag.resolution_notes ?? "");

  const { data: audit = [], isLoading: auditLoading } = useQuery(
    governanceFlagAuditQO(flag.id, flag.workspace_id, isAdmin),
  );

  const allowedNextStatuses = useMemo(() => {
    const base = ALLOWED_FLAG_TRANSITIONS[flag.status] ?? [];
    return [flag.status, ...base];
  }, [flag.status]);

  const mut = useMutation({
    mutationFn: (patch: { status?: string; assigneeId?: string | null; resolutionNotes?: string | null }) =>
      updateFn({
        data: {
          flagId: flag.id,
          status: patch.status as never,
          assigneeId: patch.assigneeId === undefined ? undefined : patch.assigneeId,
          resolutionNotes: patch.resolutionNotes === undefined ? undefined : patch.resolutionNotes,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Flag updated");
      qc.invalidateQueries({ queryKey: ["scale", "governance_flags_full", flag.workspace_id] });
      qc.invalidateQueries({ queryKey: ["scale", "governance_flags_summary", flag.workspace_id] });
      qc.invalidateQueries({ queryKey: ["scale", "governance_flag_audit", flag.id] });
      qc.invalidateQueries({ queryKey: ["scale", "audit_month_count", flag.workspace_id] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Update failed"),
  });

  const dirtyStatus = status !== flag.status;
  const dirtyAssignee = (assigneeId || null) !== (flag.assignee_id || null);
  const dirtyNotes = (notes || "") !== (flag.resolution_notes || "");

  return (
    <div className="bg-mist/40 px-4 py-3 text-[12px]">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate">What this rule means</p>
            <p className="mt-1 text-navy">
              {RULE_EXPLANATION[flag.rule_code] ??
                "No plain-English explanation registered for this rule code."}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate">Linked use case</p>
            <p className="mt-1 text-navy">
              {flag.use_cases?.name ?? "—"}
              {flag.use_cases?.function && (
                <span className="ml-2 text-graphite">· {flag.use_cases.function}</span>
              )}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate">Roadmap stage</p>
            <p className="mt-1 text-navy">
              {flag.roadmap_entries?.stage
                ? flag.roadmap_entries.stage.charAt(0).toUpperCase() + flag.roadmap_entries.stage.slice(1)
                : "Not yet on roadmap"}
            </p>
          </div>

          {isAdmin ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[11px] text-slate">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="rounded border border-chalk bg-paper px-2 py-1 text-[12px] text-navy"
                >
                  {allowedNextStatuses.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s] ?? s}
                    </option>
                  ))}
                </select>
                <label className="text-[11px] text-slate ml-2">Assignee</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="rounded border border-chalk bg-paper px-2 py-1 text-[12px] text-navy"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name ?? "Member"}
                    </option>
                  ))}
                </select>
              </div>
              <label className="block">
                <span className="text-[11px] text-slate">Resolution notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded border border-chalk bg-paper px-2 py-1 text-[12px]"
                  placeholder="What was done, or why this is being closed?"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={!dirtyStatus || mut.isPending}
                  onClick={() => mut.mutate({ status })}
                  className="rounded-full bg-navy px-3 py-1 text-[12px] text-white hover:opacity-90 disabled:opacity-40"
                >
                  Save status
                </button>
                <button
                  disabled={!dirtyAssignee || mut.isPending}
                  onClick={() => mut.mutate({ assigneeId: assigneeId || null })}
                  className="rounded-full border border-chalk bg-paper px-3 py-1 text-[12px] text-navy hover:bg-mist disabled:opacity-40"
                >
                  Save assignee
                </button>
                <button
                  disabled={!dirtyNotes || mut.isPending}
                  onClick={() => mut.mutate({ resolutionNotes: notes || null })}
                  className="rounded-full border border-chalk bg-paper px-3 py-1 text-[12px] text-navy hover:bg-mist disabled:opacity-40"
                >
                  Save notes
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate">Resolution notes</p>
              <p className="mt-1 whitespace-pre-wrap text-navy">
                {flag.resolution_notes?.trim() || <span className="italic text-slate">No notes yet</span>}
              </p>
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate">Audit trail</p>
          {auditLoading ? (
            <p className="mt-1 text-slate">Loading…</p>
          ) : audit.length === 0 ? (
            <p className="mt-1 text-slate italic">No audit entries yet for this flag.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {audit.map((a) => {
                const actor = a.actor_id ? memberById.get(a.actor_id) : null;
                return (
                  <li key={a.id} className="rounded border border-chalk bg-paper p-2">
                    <p className="text-[11px] text-navy">
                      <span className="font-medium">{describeAction(a.action_type)}</span>
                      <span className="text-slate"> · {new Date(a.created_at).toLocaleString()}</span>
                    </p>
                    <p className="text-[11px] text-graphite">
                      by {actor?.full_name ?? (a.actor_id ? "Member" : "System")}
                    </p>
                    {renderAuditChange(a)}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Bits ----------

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="text-[11px] text-slate">
      <span className="block">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded border border-chalk bg-paper px-2 py-1 text-[12px] text-navy"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  confirmDisabled,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-4" onClick={onCancel}>
      <div className="card max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-[16px] text-navy">{title}</h3>
        <p className="text-[12px] text-graphite">{body}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full border border-chalk bg-paper px-3 py-1.5 text-[12px] text-navy hover:bg-mist"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="rounded-full bg-terracotta px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function describeAction(type: string): string {
  switch (type) {
    case "governance_flag_created":
      return "Flag created";
    case "governance_flag_status_changed":
      return "Status changed";
    case "governance_flag_assigned":
      return "Assignee changed";
    case "governance_flag_notes_updated":
      return "Notes updated";
    default:
      return type.replace(/_/g, " ");
  }
}

function renderAuditChange(a: { before_state: unknown; after_state: unknown }) {
  const before = a.before_state as Record<string, unknown> | null;
  const after = a.after_state as Record<string, unknown> | null;
  if (!before && !after) return null;
  const keys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  if (keys.size === 0) return null;
  return (
    <ul className="mt-1 text-[11px] text-graphite space-y-0.5">
      {Array.from(keys).map((k) => (
        <li key={k}>
          <span className="text-slate">{k}: </span>
          <span className="line-through opacity-60">{fmtVal(before?.[k])}</span>
          <span className="mx-1">→</span>
          <span>{fmtVal(after?.[k])}</span>
        </li>
      ))}
    </ul>
  );
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return v.length > 80 ? v.slice(0, 80) + "…" : v;
  return JSON.stringify(v);
}
