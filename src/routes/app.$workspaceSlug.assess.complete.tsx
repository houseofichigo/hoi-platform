import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAssessAllProgress } from "@/hooks/useAssess";
import { ProgramCompletionDashboard } from "@/components/assess/ProgramCompletionDashboard";

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
    <ProgramCompletionDashboard
      workspaceSlug={workspace.slug}
      workspaceName={workspace.name}
      progress={progress ?? {}}
      presentOutputs={presentOutputs}
      decisions={decisionsQuery.data ?? []}
    />
  );
}
