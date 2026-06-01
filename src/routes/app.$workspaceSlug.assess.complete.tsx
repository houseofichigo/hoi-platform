import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAssessAllProgress } from "@/hooks/useAssess";
import { ProgramCompletionDashboard } from "@/components/assess/ProgramCompletionDashboard";
import { scoreAssessment } from "@/lib/assess/scoring.functions";

export const Route = createFileRoute("/app/$workspaceSlug/assess/complete")({
  component: AssessCompletePage,
});

interface OutputRow {
  output_key: string;
  value: unknown;
  updated_at: string;
}

interface GateDecisionRow {
  gate_number: number;
  module_id: string;
  decision: string;
  justification: string;
  constraints: string[];
  rationales: string[];
  updated_at: string;
}

function AssessCompletePage() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { data: progress } = useAssessAllProgress();
  const runScore = useServerFn(scoreAssessment);

  const outputsQuery = useQuery({
    enabled: !!user && !!workspace,
    queryKey: ["assess-outputs-all", workspace?.id, user?.id],
    queryFn: async (): Promise<OutputRow[]> => {
      const { data, error } = await supabase
        .from("assess_outputs")
        .select("output_key, value, updated_at")
        .eq("workspace_id", workspace!.id)
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as OutputRow[];
    },
  });

  const decisionsQuery = useQuery({
    enabled: !!user && !!workspace,
    queryKey: ["assess-gate-decisions-all", workspace?.id, user?.id],
    queryFn: async (): Promise<GateDecisionRow[]> => {
      const { data, error } = await supabase
        .from("assess_gate_decisions")
        .select(
          "gate_number, module_id, decision, justification, constraints, rationales, updated_at",
        )
        .eq("workspace_id", workspace!.id)
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as GateDecisionRow[];
    },
  });

  const latestScoreQuery = useQuery({
    enabled: !!workspace && !!user,
    queryKey: ["assessment-score-latest", workspace?.id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_score_snapshots")
        .select("id, computed_outputs, scoring_model_version, confidence, computed_at")
        .eq("workspace_id", workspace!.id)
        .eq("user_id", user!.id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        computed_outputs: Record<string, unknown>;
        scoring_model_version: string;
        confidence: number;
        computed_at: string;
      } | null;
    },
  });

  const scoreMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("Workspace not ready");
      return runScore({ data: { workspaceId: workspace.id } });
    },
    onSuccess: () => {
      latestScoreQuery.refetch();
      toast.success("Official assessment score saved");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  if (!workspace || !user) return null;

  const presentOutputs = new Set(
    (outputsQuery.data ?? [])
      .filter((r) => {
        const v = r.value;
        if (v === null || v === undefined) return false;
        if (typeof v === "string") return v.trim().length > 0;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === "object") return Object.keys(v as object).length > 0;
        return true;
      })
      .map((r) => r.output_key),
  );

  return (
    <div className="space-y-6">
      <AssessmentScorePanel
        score={latestScoreQuery.data?.computed_outputs}
        computedAt={latestScoreQuery.data?.computed_at}
        version={latestScoreQuery.data?.scoring_model_version}
        isPending={scoreMutation.isPending}
        onCompute={() => scoreMutation.mutate()}
      />
      <ProgramCompletionDashboard
        workspaceSlug={workspace.slug}
        workspaceName={workspace.name}
        progress={progress ?? {}}
        presentOutputs={presentOutputs}
        decisions={decisionsQuery.data ?? []}
      />
    </div>
  );
}

function AssessmentScorePanel({
  score,
  computedAt,
  version,
  isPending,
  onCompute,
}: {
  score: Record<string, unknown> | undefined;
  computedAt: string | undefined;
  version: string | undefined;
  isPending: boolean;
  onCompute: () => void;
}) {
  const overall = typeof score?.overall_score === "number" ? score.overall_score : null;
  const maturity = typeof score?.maturity_label === "string" ? score.maturity_label : "Not scored";
  const confidence = typeof score?.evidence_confidence === "number" ? score.evidence_confidence : null;
  const weakest =
    score?.weakest_capability && typeof score.weakest_capability === "object"
      ? (score.weakest_capability as { label?: string; score?: number })
      : null;
  const actions = Array.isArray(score?.recommended_actions) ? (score.recommended_actions as string[]) : [];

  return (
    <section className="rounded-md border border-chalk bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow-muted">Official readiness score</p>
          <h2 className="mt-2 text-[22px] font-semibold text-navy">
            {overall == null ? "Create the executive diagnostic snapshot" : `${overall}/100 · ${maturity}`}
          </h2>
          <p className="mt-2 max-w-[68ch] text-[13px] leading-relaxed text-graphite">
            This snapshot is the backend-owned assessment score used in reports, KSA readiness evidence,
            and downstream Build constraints.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={onCompute}
          className="btn-ichigo btn-ichigo-primary text-[13px]"
        >
          {isPending ? "Saving…" : overall == null ? "Compute official score" : "Recompute score"}
        </button>
      </div>

      {overall != null && (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <MiniMetric label="Evidence confidence" value={confidence == null ? "—" : `${confidence}/100`} />
          <MiniMetric label="Weakest capability" value={weakest?.label ?? "—"} />
          <MiniMetric
            label="Snapshot"
            value={computedAt ? new Date(computedAt).toLocaleString() : "—"}
            detail={version ? `Model ${version}` : undefined}
          />
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-5 rounded-md bg-mist p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">Recommended next actions</p>
          <ul className="mt-2 space-y-1 text-[13px] text-navy">
            {actions.map((action) => (
              <li key={action}>• {action}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function MiniMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md border border-chalk bg-paper p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">{label}</p>
      <p className="mt-1 text-[14px] font-medium text-navy">{value}</p>
      {detail && <p className="mt-1 text-[11px] text-slate">{detail}</p>}
    </div>
  );
}
