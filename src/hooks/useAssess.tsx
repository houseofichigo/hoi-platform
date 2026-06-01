import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { MODULES, type ModuleId } from "@/lib/curriculum";
import { resolveWorkedExample, type WorkedExampleMeta } from "@/lib/worked-examples";

/* ============== Worked example ============== */

export function useWorkedExample(): {
  data: WorkedExampleMeta | null;
  isLoading: boolean;
} {
  const { workspace } = useWorkspace();
  const q = useQuery({
    enabled: !!workspace,
    queryKey: ["workspace-worked-example", workspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("worked_example")
        .eq("id", workspace!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.worked_example ?? null;
    },
  });
  return {
    data: resolveWorkedExample(q.data ?? null),
    isLoading: q.isLoading,
  };
}

/* ============== Progress ============== */

export interface AssessProgressRow {
  module_id: string;
  status: "not_started" | "in_progress" | "complete";
  studied: boolean;
  current_step: number | null;
  max_step_reached: number;
  started_at: string | null;
  completed_at: string | null;
}

export function useAssessProgress(moduleId: ModuleId) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const qc = useQueryClient();

  const query = useQuery({
    enabled: !!user && !!workspace,
    queryKey: ["assess-progress", workspace?.id, user?.id, moduleId],
    queryFn: async (): Promise<AssessProgressRow | null> => {
      const { data, error } = await supabase
        .from("assess_progress")
        .select("module_id, status, studied, current_step, max_step_reached, started_at, completed_at")
        .eq("workspace_id", workspace!.id)
        .eq("user_id", user!.id)
        .eq("module_id", moduleId)
        .maybeSingle();
      if (error) throw error;
      return (data as AssessProgressRow | null) ?? null;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["assess-progress", workspace?.id, user?.id, moduleId] });
    qc.invalidateQueries({ queryKey: ["assess-progress-all", workspace?.id, user?.id] });
    qc.invalidateQueries({ queryKey: ["resume", workspace?.id] });
    qc.invalidateQueries({ queryKey: ["team-status", workspace?.id] });
  };

  const upsert = async (patch: Partial<AssessProgressRow>) => {
    if (!user || !workspace) return;
    const existing = query.data;
    const next = {
      workspace_id: workspace.id,
      user_id: user.id,
      module_id: moduleId,
      status: patch.status ?? existing?.status ?? "not_started",
      studied: patch.studied ?? existing?.studied ?? false,
      current_step: patch.current_step ?? existing?.current_step ?? null,
      max_step_reached: Math.max(
        existing?.max_step_reached ?? 0,
        patch.max_step_reached ?? 0,
      ),
      started_at: patch.started_at ?? existing?.started_at ?? null,
      completed_at: patch.completed_at ?? existing?.completed_at ?? null,
    };
    const { error } = await supabase
      .from("assess_progress")
      .upsert(next, { onConflict: "workspace_id,user_id,module_id" });
    if (error) throw error;
  };

  const setStudied = useMutation({
    mutationFn: async (studied: boolean) => {
      await upsert({
        studied,
        status: studied && (query.data?.status ?? "not_started") === "not_started" ? "in_progress" : query.data?.status,
        started_at: query.data?.started_at ?? new Date().toISOString(),
      });
    },
    onSuccess: invalidate,
  });

  const setStep = useMutation({
    mutationFn: async (step: number) => {
      await upsert({
        current_step: step,
        max_step_reached: step,
        status: "in_progress",
        started_at: query.data?.started_at ?? new Date().toISOString(),
      });
    },
    onSuccess: invalidate,
  });

  const markComplete = useMutation({
    mutationFn: async () => {
      await upsert({
        status: "complete",
        completed_at: new Date().toISOString(),
      });
    },
    onSuccess: invalidate,
  });

  return { ...query, setStudied, setStep, markComplete };
}

export function useAssessAllProgress() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  return useQuery({
    enabled: !!user && !!workspace,
    queryKey: ["assess-progress-all", workspace?.id, user?.id],
    queryFn: async (): Promise<Record<string, AssessProgressRow>> => {
      const { data, error } = await supabase
        .from("assess_progress")
        .select("module_id, status, studied, current_step, max_step_reached, started_at, completed_at")
        .eq("workspace_id", workspace!.id)
        .eq("user_id", user!.id);
      if (error) throw error;
      const map: Record<string, AssessProgressRow> = {};
      (data ?? []).forEach((row) => {
        map[row.module_id] = row as AssessProgressRow;
      });
      return map;
    },
  });
}

/* ============== Outputs ============== */

export function useAssessOutput<T = unknown>(outputKey: string) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const qc = useQueryClient();

  const queryKey = ["assess-output", workspace?.id, user?.id, outputKey] as const;

  const query = useQuery({
    enabled: !!user && !!workspace && !!outputKey,
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assess_outputs")
        .select("value, seeded, touched")
        .eq("workspace_id", workspace!.id)
        .eq("user_id", user!.id)
        .eq("output_key", outputKey)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  type CacheShape = { value: unknown; seeded: boolean; touched: boolean } | null;

  const setValue = useMutation({
    mutationFn: async (value: T) => {
      if (!user || !workspace) return;
      const { error } = await supabase.from("assess_outputs").upsert(
        {
          workspace_id: workspace.id,
          user_id: user.id,
          output_key: outputKey,
          value: value as never,
          touched: true,
          seeded: query.data?.seeded ?? false,
        },
        { onConflict: "workspace_id,user_id,output_key" },
      );
      if (error) throw error;
    },
    onMutate: async (value: T) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<CacheShape>(queryKey);
      qc.setQueryData<CacheShape>(queryKey, {
        value,
        seeded: previous?.seeded ?? false,
        touched: true,
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(queryKey, context.previous);
      }
      // Lazy toast import to avoid a top-level dependency change
      import("sonner").then(({ toast }) =>
        toast.error("Failed to save. Your change has been reverted."),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  return {
    value: (query.data?.value as T | undefined) ?? undefined,
    seeded: query.data?.seeded ?? false,
    touched: query.data?.touched ?? false,
    isLoading: query.isLoading,
    setValue,
  };
}

/* ============== Gate decisions ============== */

export interface GateDecisionRow {
  gate_number: 1 | 2 | 3;
  module_id: string;
  decision: "continue" | "constraints" | "improve" | "stop";
  justification: string;
  criteria_responses: Record<string, "yes" | "partial" | "no">;
  constraints: string[];
  rationales: string[];
}

export function useAssessGateDecision(gateNumber: 1 | 2 | 3) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const qc = useQueryClient();

  const query = useQuery({
    enabled: !!user && !!workspace,
    queryKey: ["assess-gate-decision", workspace?.id, user?.id, gateNumber],
    queryFn: async (): Promise<GateDecisionRow | null> => {
      const { data, error } = await supabase
        .from("assess_gate_decisions")
        .select("gate_number, module_id, decision, justification, criteria_responses, constraints, rationales")
        .eq("workspace_id", workspace!.id)
        .eq("user_id", user!.id)
        .eq("gate_number", gateNumber)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as GateDecisionRow | null) ?? null;
    },
  });

  const submit = useMutation({
    mutationFn: async (payload: Omit<GateDecisionRow, "gate_number">) => {
      if (!user || !workspace) throw new Error("Not ready");
      const { error } = await supabase.from("assess_gate_decisions").upsert(
        {
          workspace_id: workspace.id,
          user_id: user.id,
          gate_number: gateNumber,
          module_id: payload.module_id,
          decision: payload.decision,
          justification: payload.justification,
          criteria_responses: payload.criteria_responses,
          constraints: payload.constraints,
          rationales: payload.rationales,
        },
        { onConflict: "workspace_id,user_id,gate_number" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assess-gate-decision", workspace?.id, user?.id, gateNumber] });
    },
  });

  return { ...query, submit };
}

/* ============== Helpers ============== */

export function moduleStatusFor(
  progress: AssessProgressRow | undefined,
): "not_started" | "in_progress" | "complete" {
  return progress?.status ?? "not_started";
}

export function currentResumeModule(allProgress: Record<string, AssessProgressRow> | undefined) {
  if (!allProgress) {
    return { module: MODULES[0], started: false };
  }
  for (const m of MODULES) {
    const p = allProgress[m.id];
    if (!p || p.status !== "complete") {
      return { module: m, started: !!p && p.status === "in_progress" };
    }
  }
  return { module: MODULES[MODULES.length - 1], started: true };
}
