import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { LibraryItem } from "@/lib/library/types";
import { TYPE_SCHEMAS } from "@/lib/library/typeSchemas";

interface Props {
  item: LibraryItem;
}

function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map((x) => asString(x)).filter(Boolean).join(", ");
  return "";
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function nested(meta: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let cur: unknown = meta;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else return "";
  }
  return asString(cur);
}

export function LibraryItemCard({ item }: Props) {
  const schema = TYPE_SCHEMAS[item.type];
  const Icon = schema.icon;

  return (
    <article className="card flex h-full flex-col gap-3 border-l-[3px] border-l-terracotta">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow-muted flex items-center gap-1.5">
            <Icon className="h-3 w-3" />
            {schema.label}
          </p>
          <h3 className="mt-1 text-[15px] font-medium leading-snug text-navy">{item.title}</h3>
        </div>
      </header>

      {item.summary && (
        <p className="text-[13px] leading-relaxed text-slate">{item.summary}</p>
      )}

      <TypeBody item={item} />

      {(item.tags.length > 0 || item.module_ids.length > 0) && (
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {item.module_ids.map((m) => (
            <span key={`m-${m}`} className="rounded-full border border-chalk px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate">
              {m}
            </span>
          ))}
          {item.tags.map((t) => (
            <span key={`t-${t}`} className="rounded-full bg-mist px-2 py-0.5 text-[11px] text-navy">
              {t}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function TypeBody({ item }: { item: LibraryItem }) {
  const m = item.metadata;
  switch (item.type) {
    case "prompts":
      return <PromptBody text={asString(m.prompt_text)} meta={m} />;
    case "agents":
      return (
        <KvBlock
          pairs={[
            ["Platform", asString(m.platform)],
            ["MCP", asArray(m.mcp_integrations).join(", ")],
          ]}
          architecture={asString(m.architecture_spec)}
          link={asString(m.n8n_template_url)}
          linkLabel="n8n template"
        />
      );
    case "assistants":
      return (
        <KvBlock
          pairs={[
            ["Platform", asString(m.recommended_platform)],
            ["Knowledge base", asString(m.knowledge_base_type)],
          ]}
          architecture={asString(m.description)}
        />
      );
    case "tools":
      return (
        <div className="space-y-2">
          <KvBlock
            pairs={[
              ["Provider", asString(m.provider)],
              ["Capability", asString(m.capability)],
              ["Pricing", asString(m.pricing_tier)],
            ]}
            link={asString(m.url)}
            linkLabel="Open tool"
          />
          <div className="flex flex-wrap gap-1.5">
            {(["data_residency", "training_optout", "mcp_support", "audit_logs"] as const).map((k) => {
              const v = nested(m, `governance_posture.${k}`);
              if (!v) return null;
              return (
                <span key={k} className="rounded-md border border-chalk px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-navy">
                  {k.replace(/_/g, " ")}: {v}
                </span>
              );
            })}
          </div>
        </div>
      );
    case "videos":
      return <VideoBody item={item} />;
    case "presentations":
      return (
        <KvBlock
          pairs={[
            ["Format", asString(m.format)],
            ["Slides", asNumber(m.slide_count)?.toString() ?? ""],
          ]}
          link={asString(m.file_url) || item.content_url || ""}
          linkLabel="Open file"
        />
      );
    case "documents":
      return (
        <KvBlock
          pairs={[
            ["Type", asString(m.document_type)],
            ["Pages", asNumber(m.page_count)?.toString() ?? ""],
          ]}
          link={asString(m.file_url) || item.content_url || ""}
          linkLabel="Open document"
        />
      );
    case "case_studies":
      return (
        <div className="space-y-2 text-[13px] text-navy">
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-slate">
            <span>Industry · {asString(m.industry) || "—"}</span>
            <span>Function · {asString(m.function) || "—"}</span>
          </div>
          <CaseRow label="Problem" value={asString(m.problem)} />
          <CaseRow label="Solution" value={asString(m.solution)} />
          <CaseRow label="Outcome" value={asString(m.outcome)} />
        </div>
      );
    case "regulatory":
      return (
        <KvBlock
          pairs={[
            ["Jurisdiction", asString(m.jurisdiction)],
            ["Framework", asString(m.framework)],
            ["Effective", asString(m.effective_date)],
          ]}
          architecture={asString(m.summary)}
        />
      );
    case "use_case_templates":
      return (
        <KvBlock
          pairs={[
            ["Industry", asString(m.industry)],
            ["Function", asString(m.function)],
            ["Complexity", asString(m.complexity)],
            ["ROI", asString(m.estimated_roi)],
          ]}
        />
      );
    case "glossary":
      return (
        <div className="space-y-1 text-[13px] text-navy">
          <p className="font-medium">{asString(m.term)}</p>
          <p className="text-slate">{asString(m.definition)}</p>
          {asArray(m.related_terms).length > 0 && (
            <p className="text-[11px] text-slate">
              Related: {asArray(m.related_terms).map((t) => asString(t)).join(", ")}
            </p>
          )}
        </div>
      );
    case "research":
      return (
        <KvBlock
          pairs={[
            ["Authors", asString(m.authors)],
            ["Published", asString(m.publication_date)],
          ]}
          architecture={asString(m.summary)}
          link={asString(m.paper_url)}
          linkLabel="Open paper"
        />
      );
    case "skills":
      return (
        <KvBlock
          pairs={[
            ["Type", asString(m.skill_type)],
            ["Methodology", asString(m.methodology_reference)],
            ["Input", asString(m.input_format)],
            ["Output", asString(m.output_format)],
            ["Version", asString(m.version)],
          ]}
        />
      );
  }
}

function CaseRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate">{label}</p>
      <p className="text-[13px] text-navy">{value}</p>
    </div>
  );
}

function KvBlock({
  pairs,
  architecture,
  link,
  linkLabel,
}: {
  pairs: [string, string][];
  architecture?: string;
  link?: string;
  linkLabel?: string;
}) {
  const visible = pairs.filter(([, v]) => v);
  return (
    <div className="space-y-2 text-[13px] text-navy">
      {visible.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
          {visible.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate">{k}</dt>
              <dd className="text-navy">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {architecture && <p className="whitespace-pre-wrap text-[13px] text-slate">{architecture}</p>}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-terracotta hover:opacity-80"
        >
          {linkLabel ?? "Open"} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function PromptBody({ text, meta }: { text: string; meta: Record<string, unknown> }) {
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Prompt copied");
    } catch {
      toast.error("Could not copy");
    }
  };
  const [show, setShow] = useState(false);
  if (!text) return null;
  return (
    <div className="space-y-2 text-[13px]">
      <div className="rounded-md border border-chalk bg-mist p-2 font-mono text-[12px] text-navy">
        <pre className={"whitespace-pre-wrap " + (show ? "" : "line-clamp-4")}>{text}</pre>
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate">
        <button onClick={() => setShow((s) => !s)} className="hover:text-navy">
          {show ? "Show less" : "Show full prompt"}
        </button>
        <button onClick={onCopy} className="inline-flex items-center gap-1 hover:text-navy">
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>
      <KvBlock
        pairs={[
          ["Framework", asString(meta.framework)],
          ["Tested on", asString(meta.tested_on)],
          ["Difficulty", asString(meta.difficulty)],
        ]}
      />
    </div>
  );
}

function VideoBody({ item }: { item: LibraryItem }) {
  const m = item.metadata;
  const url = asString(m.video_url) || item.content_url || "";
  const thumb = asString(m.thumbnail_url);
  const dur = asNumber(m.duration_seconds);
  const transcript = asString(m.transcript_url);
  const markers = asArray(m.chapter_markers) as { time?: number; label?: string }[];
  const embedUrl = toEmbed(url);
  return (
    <div className="space-y-2 text-[13px]">
      {embedUrl ? (
        <div className="aspect-video w-full overflow-hidden rounded-md border border-chalk">
          <iframe src={embedUrl} title={item.title} className="h-full w-full" allowFullScreen />
        </div>
      ) : thumb ? (
        <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-chalk">
          <img src={thumb} alt={item.title} className="aspect-video w-full object-cover" />
        </a>
      ) : null}
      <div className="flex flex-wrap gap-3 text-[11px] text-slate">
        {dur != null && <span>Duration · {Math.floor(dur / 60)}m {dur % 60}s</span>}
        {transcript && (
          <a href={transcript} target="_blank" rel="noreferrer" className="text-terracotta hover:opacity-80">
            Transcript →
          </a>
        )}
      </div>
      {markers.length > 0 && (
        <ul className="text-[12px] text-navy">
          {markers.slice(0, 6).map((c, i) => (
            <li key={i}>
              <span className="font-mono text-slate">{formatTime(c.time ?? 0)}</span> · {c.label ?? ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function toEmbed(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.replace(/^\//, "")}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.replace(/^\//, "");
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}
