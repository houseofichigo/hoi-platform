import {
  BookOpen,
  Bot,
  FileText,
  FileType,
  FlaskConical,
  GraduationCap,
  Layers,
  Library,
  MessageSquare,
  Presentation,
  Scale,
  Sparkles,
  Video,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { LibraryType } from "./types";

export interface MetadataField {
  key: string;
  label: string;
  kind: "text" | "textarea" | "number" | "url" | "date" | "tags" | "select" | "json";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
}

export interface LibraryTypeSchema {
  id: LibraryType;
  label: string;
  plural: string;
  slug: string;
  description: string;
  icon: LucideIcon;
  fields: MetadataField[];
  defaultMetadata: Record<string, unknown>;
  /** When set, the type is file-based: published items must have either metadata[fileUrlKey] or item.content_url. */
  fileUrlKey?: string;
}

export const TYPE_SCHEMAS: Record<LibraryType, LibraryTypeSchema> = {
  prompts: {
    id: "prompts",
    label: "Prompt",
    plural: "Prompts",
    slug: "prompts",
    description: "Tested prompts with framework, expected input/output, and difficulty.",
    icon: MessageSquare,
    fields: [
      { key: "prompt_text", label: "Prompt text", kind: "textarea", required: true },
      { key: "framework", label: "Framework", kind: "text", placeholder: "e.g. CRISPE, RTF, RACE" },
      { key: "tested_on", label: "Tested on", kind: "tags", options: ["Claude", "ChatGPT", "Gemini"], placeholder: "Claude, ChatGPT, Gemini" },
      { key: "expected_input", label: "Expected input", kind: "textarea" },
      { key: "expected_output", label: "Expected output", kind: "textarea" },
      { key: "difficulty", label: "Difficulty", kind: "select", options: ["beginner", "intermediate", "advanced"] },
    ],
    defaultMetadata: { difficulty: "beginner" },
  },
  agents: {
    id: "agents",
    label: "Agent",
    plural: "Agents",
    slug: "agents",
    description: "Multi-step agents with architecture, platform, and MCP integrations.",
    icon: Bot,
    fields: [
      { key: "architecture_spec", label: "Architecture summary", kind: "textarea", required: true },
      { key: "n8n_template_url", label: "n8n template URL", kind: "url" },
      { key: "platform", label: "Platform", kind: "text", placeholder: "e.g. n8n, LangGraph, OpenAI Assistants" },
      { key: "mcp_integrations", label: "MCP integrations", kind: "tags", placeholder: "comma-separated" },
      { key: "screenshots", label: "Screenshots (URLs)", kind: "tags", placeholder: "comma-separated URLs" },
    ],
    defaultMetadata: { mcp_integrations: [], screenshots: [] },
  },
  assistants: {
    id: "assistants",
    label: "Assistant",
    plural: "Assistants",
    slug: "assistants",
    description: "Single-turn assistants with setup instructions and knowledge base.",
    icon: Sparkles,
    fields: [
      { key: "description", label: "Description", kind: "textarea", required: true },
      { key: "setup_instructions", label: "Setup instructions", kind: "textarea" },
      { key: "recommended_platform", label: "Recommended platform", kind: "text" },
      { key: "knowledge_base_type", label: "Knowledge base type", kind: "text" },
    ],
    defaultMetadata: {},
  },
  tools: {
    id: "tools",
    label: "Tool",
    plural: "Tools",
    slug: "tools",
    description: "AI tools and platforms with provider, capability, and governance posture.",
    icon: Wrench,
    fields: [
      { key: "provider", label: "Provider", kind: "text", required: true },
      { key: "capability", label: "Capability", kind: "text" },
      { key: "pricing_tier", label: "Pricing tier", kind: "select", options: ["free", "freemium", "paid", "enterprise"] },
      { key: "url", label: "URL", kind: "url" },
      { key: "governance_posture.data_residency", label: "Data residency", kind: "text", placeholder: "e.g. EU, US, global" },
      { key: "governance_posture.training_optout", label: "Training opt-out", kind: "select", options: ["yes", "no", "configurable", "unknown"] },
      { key: "governance_posture.mcp_support", label: "MCP support", kind: "select", options: ["yes", "no", "planned", "unknown"] },
      { key: "governance_posture.audit_logs", label: "Audit logs", kind: "select", options: ["yes", "no", "enterprise-only", "unknown"] },
    ],
    defaultMetadata: { governance_posture: {} },
  },
  videos: {
    id: "videos",
    label: "Video",
    plural: "Videos",
    slug: "videos",
    description: "Embedded videos with transcripts and chapter markers.",
    icon: Video,
    fileUrlKey: "video_url",
    fields: [
      { key: "video_url", label: "Video URL", kind: "url", help: "Optional if a Content URL is provided." },
      { key: "duration_seconds", label: "Duration (seconds)", kind: "number" },
      { key: "thumbnail_url", label: "Thumbnail URL", kind: "url" },
      { key: "transcript_url", label: "Transcript URL", kind: "url" },
      { key: "chapter_markers", label: "Chapter markers (JSON)", kind: "json", placeholder: '[{"time":0,"label":"Intro"}]' },
    ],
    defaultMetadata: { chapter_markers: [] },
  },
  presentations: {
    id: "presentations",
    label: "Presentation",
    plural: "Presentations",
    slug: "presentations",
    description: "Slide decks and presentations.",
    icon: Presentation,
    fileUrlKey: "file_url",
    fields: [
      { key: "file_url", label: "File URL", kind: "url", help: "Optional if a Content URL is provided." },
      { key: "slide_count", label: "Slide count", kind: "number" },
      { key: "format", label: "Format", kind: "select", options: ["pptx", "pdf", "google_slides"] },
    ],
    defaultMetadata: {},
  },
  documents: {
    id: "documents",
    label: "Document",
    plural: "Documents",
    slug: "documents",
    description: "Reference documents, guides, and PDFs.",
    icon: FileText,
    fileUrlKey: "file_url",
    fields: [
      { key: "file_url", label: "File URL", kind: "url", help: "Optional if a Content URL is provided." },
      { key: "document_type", label: "Document type", kind: "select", options: ["guide", "template", "reference", "policy"] },
      { key: "page_count", label: "Page count", kind: "number" },
    ],
    defaultMetadata: {},
  },
  case_studies: {
    id: "case_studies",
    label: "Case study",
    plural: "Case studies",
    slug: "case-studies",
    description: "Real-world deployments with problem, solution, and outcome.",
    icon: Layers,
    fields: [
      { key: "function", label: "Function", kind: "text", placeholder: "e.g. Finance, Ops, HR" },
      { key: "industry", label: "Industry", kind: "text" },
      { key: "company_size", label: "Company size", kind: "select", options: ["startup", "smb", "mid-market", "enterprise"] },
      { key: "problem", label: "Problem", kind: "textarea", required: true },
      { key: "solution", label: "Solution", kind: "textarea", required: true },
      { key: "outcome", label: "Outcome", kind: "textarea", required: true },
    ],
    defaultMetadata: {},
  },
  regulatory: {
    id: "regulatory",
    label: "Regulatory",
    plural: "Regulatory",
    slug: "regulatory",
    description: "Laws, frameworks, and compliance references.",
    icon: Scale,
    fields: [
      { key: "jurisdiction", label: "Jurisdiction", kind: "text", required: true, placeholder: "e.g. EU, US, UK, global" },
      { key: "framework", label: "Framework", kind: "select", options: ["eu_ai_act", "gdpr", "iso_42001", "nist"] },
      { key: "effective_date", label: "Effective date", kind: "date" },
      { key: "summary", label: "Summary", kind: "textarea" },
    ],
    defaultMetadata: {},
  },
  use_case_templates: {
    id: "use_case_templates",
    label: "Use-case template",
    plural: "Use-case templates",
    slug: "templates",
    description: "Pre-scored use-case templates by industry and function.",
    icon: FileType,
    fields: [
      { key: "industry", label: "Industry", kind: "text", required: true },
      { key: "function", label: "Function", kind: "text", required: true },
      { key: "complexity", label: "Complexity", kind: "select", options: ["low", "medium", "high"] },
      { key: "estimated_roi", label: "Estimated ROI", kind: "text", placeholder: "e.g. 3-5x, 12-month payback" },
      { key: "pre_scored_pillars", label: "Pre-scored pillars (JSON)", kind: "json", placeholder: '{"feasibility":7,"impact":8}' },
    ],
    defaultMetadata: { pre_scored_pillars: {} },
  },
  glossary: {
    id: "glossary",
    label: "Glossary term",
    plural: "Glossary",
    slug: "glossary",
    description: "Curriculum terminology, defined.",
    icon: BookOpen,
    fields: [
      { key: "term", label: "Term", kind: "text", required: true },
      { key: "definition", label: "Definition", kind: "textarea", required: true },
      { key: "module_first_introduced", label: "Module first introduced", kind: "text", placeholder: "e.g. m01" },
      { key: "related_terms", label: "Related terms", kind: "tags" },
    ],
    defaultMetadata: { related_terms: [] },
  },
  research: {
    id: "research",
    label: "Research paper",
    plural: "Research",
    slug: "research",
    description: "Papers and studies relevant to the curriculum.",
    icon: FlaskConical,
    fields: [
      { key: "paper_url", label: "Paper URL", kind: "url" },
      { key: "authors", label: "Authors", kind: "tags", placeholder: "comma-separated" },
      { key: "publication_date", label: "Publication date", kind: "date" },
      { key: "summary", label: "Summary", kind: "textarea" },
      { key: "relevance_to_curriculum", label: "Relevance to curriculum", kind: "textarea" },
    ],
    defaultMetadata: {},
  },
  skills: {
    id: "skills",
    label: "Skill",
    plural: "Skills",
    slug: "skills",
    description: "Reusable skills, methodologies, and input/output formats.",
    icon: GraduationCap,
    fields: [
      { key: "skill_type", label: "Skill type", kind: "text", required: true },
      { key: "methodology_reference", label: "Methodology reference", kind: "text" },
      { key: "input_format", label: "Input format", kind: "text" },
      { key: "output_format", label: "Output format", kind: "text" },
      { key: "version", label: "Version", kind: "text", placeholder: "e.g. 1.0" },
    ],
    defaultMetadata: {},
  },
};

export const TYPE_LIST: LibraryTypeSchema[] = Object.values(TYPE_SCHEMAS);

export function getSchemaBySlug(slug: string): LibraryTypeSchema | undefined {
  return TYPE_LIST.find((s) => s.slug === slug);
}

// Overall library icon for "Overview"
export const LIBRARY_OVERVIEW_ICON: LucideIcon = Library;
