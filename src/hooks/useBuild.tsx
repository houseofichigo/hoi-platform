import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";

export interface UseCaseRow {
  id: string;
  workspace_id: string;
  created_by: string | null;
  name: string;
  function: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  lifecycle_state?: string | null;
  capture_v2?: Record<string, unknown> | null;
  derived_scores?: Record<string, unknown> | null;
  capture_version?: string | null;
}

export interface CaptureRow {
  id: string;
  use_case_id: string;
  block_number: number;
  block_title: string | null;
  responses: Record<string, unknown>;
  completed_at: string | null;
}

export interface ScoreRow {
  id: string;
  use_case_id: string;
  pillar_scores: Record<string, number>;
  delivery_readiness: number | null;
  priority: number | null;
  quadrant: string | null;
  /** Legacy tier (kept for backwards compat). V2 prefers `classification`. */
  tier?: string | null;
  reason_codes: string[];
  gate_statuses: Record<string, { status: string; checks: Record<string, boolean | string> }>;
  step_automation_map: Record<string, number>;
  scored_at: string | null;
  // v2 columns
  classification?: string | null;
  complexity_score?: number | null;
  complexity_tag?: string | null;
  business_impact?: number | null;
  feasibility?: number | null;
  process_maturity?: number | null;
  risk?: number | null;
  ai_suitability?: number | null;
  agent_suitability?: number | null;
  scoring_version?: string | null;
}

export interface ApprovalRow {
  id: string;
  use_case_id: string;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision: string;
  comment: string | null;
}

export function useUseCases() {
  const { workspace } = useWorkspace();
  return useQuery({
    enabled: !!workspace,
    queryKey: ["use_cases", workspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("use_cases")
        .select("*")
        .eq("workspace_id", workspace!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UseCaseRow[];
    },
  });
}

export function useUseCase(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["use_case", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("use_cases").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as UseCaseRow | null;
    },
  });
}

export function useCaptures(useCaseId: string | undefined) {
  return useQuery({
    enabled: !!useCaseId,
    queryKey: ["use_case_captures", useCaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("use_case_captures")
        .select("*")
        .eq("use_case_id", useCaseId!)
        .order("block_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CaptureRow[];
    },
  });
}

export function useScore(useCaseId: string | undefined) {
  return useQuery({
    enabled: !!useCaseId,
    queryKey: ["use_case_score", useCaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("use_case_scores")
        .select("*")
        .eq("use_case_id", useCaseId!)
        .maybeSingle();
      if (error) throw error;
      return data as ScoreRow | null;
    },
  });
}

export function useScores() {
  const { workspace } = useWorkspace();
  return useQuery({
    enabled: !!workspace,
    queryKey: ["use_case_scores_all", workspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("use_case_scores")
        .select("*, use_cases!inner(workspace_id)")
        .eq("use_cases.workspace_id", workspace!.id);
      if (error) throw error;
      return (data ?? []) as unknown as (ScoreRow & { use_cases: { workspace_id: string } })[];
    },
  });
}


export function useApproval(useCaseId: string | undefined) {
  return useQuery({
    enabled: !!useCaseId,
    queryKey: ["use_case_approval", useCaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("use_case_approvals")
        .select("*")
        .eq("use_case_id", useCaseId!)
        .maybeSingle();
      if (error) throw error;
      return data as ApprovalRow | null;
    },
  });
}

export function useApprovals() {
  const { workspace } = useWorkspace();
  return useQuery({
    enabled: !!workspace,
    queryKey: ["use_case_approvals_all", workspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("use_case_approvals")
        .select("*, use_cases!inner(id, name, function, workspace_id, status, created_by)")
        .eq("use_cases.workspace_id", workspace!.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (ApprovalRow & {
        use_cases: { id: string; name: string; function: string; workspace_id: string; status: string; created_by: string | null };
      })[];
    },
  });
}

export function useCreateUseCase() {
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; function: string; description?: string }) => {
      if (!workspace || !user) throw new Error("Not ready");
      const { data, error } = await supabase
        .from("use_cases")
        .insert({
          workspace_id: workspace.id,
          created_by: user.id,
          name: input.name,
          function: input.function,
          description: input.description ?? null,
          status: "capturing",
        })
        .select()
        .single();
      if (error) throw error;
      return data as UseCaseRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["use_cases", workspace?.id] });
    },
  });
}

export function useSaveCapture(useCaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { block_number: number; block_title: string; responses: Record<string, unknown>; completed?: boolean }) => {
      const { error } = await supabase
        .from("use_case_captures")
        .upsert(
          {
            use_case_id: useCaseId,
            block_number: input.block_number,
            block_title: input.block_title,
            responses: input.responses as never,
            completed_at: input.completed ? new Date().toISOString() : null,
          },
          { onConflict: "use_case_id,block_number" },
        );
      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["use_case_captures", useCaseId] });
    },
  });
}

/**
 * useSaveCaptureV2 — persists the full V2 capture blob to
 * `use_cases.capture_v2` (jsonb). Merges with the existing blob, so partial
 * step saves don't clobber earlier blocks.
 */
export function useSaveCaptureV2(useCaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { data: existing, error: readErr } = await supabase
        .from("use_cases")
        .select("capture_v2")
        .eq("id", useCaseId)
        .maybeSingle();
      if (readErr) throw readErr;
      const merged = {
        ...((existing?.capture_v2 ?? {}) as Record<string, unknown>),
        ...patch,
      };
      const { error } = await supabase
        .from("use_cases")
        .update({ capture_v2: merged as never, capture_version: "2.2" })
        .eq("id", useCaseId);
      if (error) throw error;
      return merged;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["use_case", useCaseId] });
      qc.invalidateQueries({ queryKey: ["use_cases"] });
    },
  });
}

export interface GovernanceFlagRow {
  id: string;
  workspace_id: string;
  use_case_id: string;
  rule_code: string;
  rule_source: string;
  severity: string;
  status: string;
}

export function useGovernanceFlagsByUseCase(useCaseId: string | undefined) {
  return useQuery({
    enabled: !!useCaseId,
    queryKey: ["governance_flags_by_uc", useCaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governance_flags")
        .select("*")
        .eq("use_case_id", useCaseId!);
      if (error) throw error;
      return (data ?? []) as GovernanceFlagRow[];
    },
  });
}

export function useGovernanceFlagsAll() {
  const { workspace } = useWorkspace();
  return useQuery({
    enabled: !!workspace,
    queryKey: ["governance_flags_all_build", workspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governance_flags")
        .select("*")
        .eq("workspace_id", workspace!.id);
      if (error) throw error;
      return (data ?? []) as GovernanceFlagRow[];
    },
  });
}

export function useCapturesAll() {
  const { workspace } = useWorkspace();
  return useQuery({
    enabled: !!workspace,
    queryKey: ["use_case_captures_all", workspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("use_case_captures")
        .select("*, use_cases!inner(workspace_id)")
        .eq("use_cases.workspace_id", workspace!.id);
      if (error) throw error;
      return (data ?? []) as unknown as CaptureRow[];
    },
  });
}

export function useDeleteUseCase() {
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  return useMutation({
    mutationFn: async (useCaseId: string) => {
      const { error } = await supabase.from("use_cases").delete().eq("id", useCaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["use_cases", workspace?.id] });
      qc.invalidateQueries({ queryKey: ["use_case_scores_all", workspace?.id] });
    },
  });
}

export function useDuplicateUseCase() {
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (source: UseCaseRow) => {
      if (!workspace || !user) throw new Error("Not ready");
      const { data: newUc, error } = await supabase
        .from("use_cases")
        .insert({
          workspace_id: workspace.id,
          created_by: user.id,
          name: `${source.name} (copy)`,
          function: source.function,
          description: source.description ?? null,
          status: "capturing",
          capture_v2: (source.capture_v2 ?? null) as never,
        })
        .select()
        .single();
      if (error) throw error;
      // duplicate legacy captures too
      const { data: captures } = await supabase
        .from("use_case_captures")
        .select("*")
        .eq("use_case_id", source.id);
      if (captures && captures.length > 0) {
        await supabase.from("use_case_captures").insert(
          captures.map((c) => ({
            use_case_id: newUc.id,
            block_number: c.block_number,
            block_title: c.block_title,
            responses: c.responses,
          })) as never,
        );
      }
      return newUc as UseCaseRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["use_cases", workspace?.id] });
    },
  });
}

export function useSubmitUseCase() {
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (useCaseId: string) => {
      if (!user) throw new Error("Not authenticated");
      // Update lifecycle + create pending approval
      await supabase.from("use_cases").update({ status: "submitted" }).eq("id", useCaseId);
      const { data, error } = await supabase
        .from("use_case_approvals")
        .upsert(
          {
            use_case_id: useCaseId,
            submitted_by: user.id,
            submitted_at: new Date().toISOString(),
            decision: "pending",
          } as never,
          { onConflict: "use_case_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["use_cases", workspace?.id] });
      qc.invalidateQueries({ queryKey: ["use_case_approvals_all", workspace?.id] });
    },
  });
}
