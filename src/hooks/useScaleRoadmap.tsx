import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  roadmapEntriesQO,
  recentStageHistoryQO,
  governanceFlagsQO,
  postPilotReviewsCountsQO,
  auditMonthCountQO,
  workspaceMembersQO,
} from "@/lib/scale/queries";
import { moveRoadmapEntry, updateRoadmapEntry } from "@/lib/scale/scale.functions";

export function useRoadmapEntries() {
  const { workspace } = useWorkspace();
  return useQuery(roadmapEntriesQO(workspace?.id));
}

export function useRecentStageHistory(limit = 5) {
  const { workspace } = useWorkspace();
  return useQuery(recentStageHistoryQO(workspace?.id, limit));
}

export function useGovernanceFlagsSummary() {
  const { workspace } = useWorkspace();
  return useQuery(governanceFlagsQO(workspace?.id));
}

export function usePostPilotReviewCounts() {
  const { workspace } = useWorkspace();
  return useQuery(postPilotReviewsCountsQO(workspace?.id));
}

export function useAuditMonthCount() {
  const { workspace } = useWorkspace();
  return useQuery(auditMonthCountQO(workspace?.id));
}

export function useWorkspaceMemberProfiles() {
  const { workspace } = useWorkspace();
  return useQuery(workspaceMembersQO(workspace?.id));
}

type MoveInput = {
  entryId: string;
  toStage: "backlog" | "pilot" | "production" | "scaling" | "retired";
  reason?: string;
  acknowledgedRequiresAction?: boolean;
};

export function useMoveRoadmapEntry() {
  const { workspace } = useWorkspace();
  const move = useServerFn(moveRoadmapEntry);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MoveInput) => move({ data: input }),
    onSuccess: () => {
      const wsId = workspace?.id;
      qc.invalidateQueries({ queryKey: ["scale", "roadmap_entries", wsId] });
      qc.invalidateQueries({ queryKey: ["scale", "recent_stage_history", wsId] });
      qc.invalidateQueries({ queryKey: ["scale", "audit_month_count", wsId] });
      qc.invalidateQueries({ queryKey: ["scale", "post_pilot_review_counts", wsId] });
    },
  });
}

type UpdateInput = {
  entryId: string;
  ownerId?: string | null;
  targetQuarter?: string | null;
};

export function useUpdateRoadmapEntry() {
  const { workspace } = useWorkspace();
  const update = useServerFn(updateRoadmapEntry);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateInput) => update({ data: input }),
    onSuccess: () => {
      const wsId = workspace?.id;
      qc.invalidateQueries({ queryKey: ["scale", "roadmap_entries", wsId] });
      qc.invalidateQueries({ queryKey: ["scale", "audit_month_count", wsId] });
    },
  });
}
