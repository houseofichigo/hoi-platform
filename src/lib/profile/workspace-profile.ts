import type { ProfileSchema } from "./schema";

const COUNTRY_GROUPS = [
  {
    label: "Western Europe",
    options: [
      "France", "Belgium", "Luxembourg", "Switzerland", "Germany",
      "Netherlands", "UK", "Ireland", "Spain", "Portugal", "Italy", "Austria",
    ],
  },
  {
    label: "Nordics & Eastern Europe",
    options: ["Sweden", "Denmark", "Norway", "Finland", "Poland", "Czech Republic", "Romania"],
  },
  {
    label: "Middle East & Africa",
    options: ["Saudi Arabia", "UAE", "Qatar", "Morocco", "Tunisia", "Senegal", "Côte d'Ivoire"],
  },
  {
    label: "Other",
    options: ["USA", "Canada", "Japan", "Singapore", "Other"],
  },
] as const;

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

const LLM_GROUPS = [
  {
    label: "General-purpose",
    options: ["Claude", "ChatGPT", "Gemini", "Mistral (Le Chat)", "Copilot (Microsoft)", "Perplexity", "Grok"],
  },
  {
    label: "API / developer",
    options: [
      "Claude API (Anthropic)", "OpenAI API", "Mistral API", "Azure OpenAI",
      "Google Vertex AI", "AWS Bedrock", "Groq", "Together AI",
    ],
  },
  {
    label: "Open-source / self-hosted",
    options: ["Llama (Meta)", "Mixtral (Mistral open)", "Qwen (Alibaba)", "Phi (Microsoft)", "Ollama (local)"],
  },
  {
    label: "Other",
    options: ["None — first time using AI", "Other"],
  },
] as const;

export const WORKSPACE_PROFILE_SCHEMA: ProfileSchema = [
  {
    key: "country",
    label: "Country",
    kind: "grouped_select",
    groups: COUNTRY_GROUPS,
    required: true,
  },
  {
    key: "industry",
    label: "Industry",
    kind: "text",
    placeholder: "e.g. specialty food import",
    required: true,
  },
  {
    key: "activity",
    label: "Activity (one sentence)",
    kind: "text",
    placeholder: "e.g. import and distribute Japanese specialty groceries to French restaurants",
    required: false,
  },
  {
    key: "company_size",
    label: "Company size",
    kind: "select",
    options: COMPANY_SIZES,
    required: true,
  },
  {
    key: "llm_platform",
    label: "LLM platform",
    hint: "The model or product your team uses most often.",
    kind: "grouped_select",
    groups: LLM_GROUPS,
    required: true,
  },
] as const;

export const WORKSPACE_PROFILE_DEFAULTS = {
  country: "France",
  industry: "",
  activity: "",
  company_size: "11-50",
  llm_platform: "Claude",
} as const;
