export const LIBRARY_TYPES = [
  "prompts",
  "agents",
  "assistants",
  "tools",
  "videos",
  "presentations",
  "documents",
  "case_studies",
  "regulatory",
  "use_case_templates",
  "glossary",
  "research",
  "skills",
] as const;

export type LibraryType = (typeof LIBRARY_TYPES)[number];

export function isLibraryType(v: string): v is LibraryType {
  return (LIBRARY_TYPES as readonly string[]).includes(v);
}

export interface LibraryItem {
  id: string;
  workspace_id: string | null;
  type: LibraryType;
  title: string;
  summary: string | null;
  module_ids: string[];
  phase_ids: string[];
  tags: string[];
  published: boolean;
  content_url: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface LibraryListFilters {
  type?: LibraryType;
  search?: string;
  moduleIds?: string[];
  phaseIds?: string[];
  tags?: string[];
  includeUnpublished?: boolean;
  limit?: number;
}
