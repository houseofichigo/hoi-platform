export const ROADMAP_STAGES = ["backlog", "pilot", "production", "scaling", "retired"] as const;
export type RoadmapStage = (typeof ROADMAP_STAGES)[number];

export const STAGE_LABEL: Record<RoadmapStage, string> = {
  backlog: "Backlog",
  pilot: "Pilot",
  production: "Production",
  scaling: "Scaling",
  retired: "Retired",
};

export interface RoadmapEntryWithRelations {
  id: string;
  workspace_id: string;
  use_case_id: string;
  owner_id: string | null;
  stage: RoadmapStage;
  target_quarter: string | null;
  priority_score: number | null;
  created_at: string;
  updated_at: string;
  use_cases: {
    id: string;
    name: string;
    function: string;
    created_by: string | null;
  } | null;
  use_case_scores: Array<{
    classification: string | null;
    quadrant: string | null;
    priority: number | null;
  }>;
  governance_flags: Array<{
    id: string;
    severity: "hard_stop" | "requires_action" | "advisory";
    status: "open" | "in_progress" | "resolved" | "accepted_risk" | "not_applicable";
  }>;
  post_pilot_reviews: Array<{
    id: string;
    recommendation: string | null;
    submitted_at: string;
  }>;
}

export interface OwnerProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface StageHistoryEntry {
  id: string;
  roadmap_entry_id: string;
  use_case_id: string;
  from_stage: RoadmapStage | null;
  to_stage: RoadmapStage;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
  use_cases: { name: string } | null;
}
