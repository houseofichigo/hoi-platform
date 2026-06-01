import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import {
  createLibraryItem,
  deleteLibraryItem,
  listLibraryItems,
  updateLibraryItem,
  uploadLibraryFile,
} from "@/lib/library/queries";
import { TYPE_LIST, TYPE_SCHEMAS } from "@/lib/library/typeSchemas";
import type { LibraryItem, LibraryType } from "@/lib/library/types";
import { isLibraryType, LIBRARY_TYPES } from "@/lib/library/types";
import { MODULES, PHASES } from "@/lib/curriculum";

export const Route = createFileRoute("/admin/library")({
  component: AdminLibrary,
});

function AdminLibrary() {
  const { user } = useAuth();
  const { isSuperAdmin, loading } = useSuperAdmin();
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<LibraryType | "">("");
  const [pubFilter, setPubFilter] = useState<"all" | "published" | "draft">("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<LibraryItem | "new" | null>(null);

  const { data: items = [], isLoading } = useQuery({
    enabled: isSuperAdmin,
    queryKey: ["library", "admin", "all"],
    queryFn: () => listLibraryItems({ includeUnpublished: true }),
  });

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (typeFilter && it.type !== typeFilter) return false;
      if (pubFilter === "published" && !it.published) return false;
      if (pubFilter === "draft" && it.published) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [it.title, it.summary ?? "", it.tags.join(" ")].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, typeFilter, pubFilter, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["library"] });
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteLibraryItem(id),
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const togglePublish = useMutation({
    mutationFn: (it: LibraryItem) => updateLibraryItem(it.id, { published: !it.published, version: it.version }),
    onSuccess: (it) => {
      toast.success(it.published ? "Published" : "Unpublished");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (loading) return <p className="p-8 text-[13px] text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-[14px] text-navy">Sign in required.</p>;
  if (!isSuperAdmin) return <p className="p-8 text-[14px] text-navy">Super-admin access required.</p>;

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">ADMIN · LIBRARY CMS</p>
          <h1 className="h-display-md mt-1">Manage the HOI library.</h1>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-2 text-[13px] font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New item
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title/summary/tags…"
          className="flex-1 min-w-[200px] rounded-md border border-chalk bg-paper px-2.5 py-1.5 text-[13px] text-navy outline-none focus:border-terracotta"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as LibraryType | "")}
          className="rounded-md border border-chalk bg-paper px-2.5 py-1.5 text-[13px] text-navy outline-none"
        >
          <option value="">All types</option>
          {TYPE_LIST.map((s) => (
            <option key={s.id} value={s.id}>
              {s.plural}
            </option>
          ))}
        </select>
        <select
          value={pubFilter}
          onChange={(e) => setPubFilter(e.target.value as typeof pubFilter)}
          className="rounded-md border border-chalk bg-paper px-2.5 py-1.5 text-[13px] text-navy outline-none"
        >
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-chalk">
          <table className="w-full text-[13px]">
            <thead className="bg-mist font-mono text-[11px] uppercase tracking-[0.14em] text-slate">
              <tr>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">v</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id} className="border-t border-chalk text-navy">
                  <td className="px-3 py-2">
                    <button onClick={() => setEditing(it)} className="hover:text-terracotta">
                      {it.title}
                    </button>
                  </td>
                  <td className="px-3 py-2">{TYPE_SCHEMAS[it.type].label}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => togglePublish.mutate(it)}
                      className={
                        "rounded-full px-2 py-0.5 text-[11px] " +
                        (it.published
                          ? "bg-terracotta text-white"
                          : "border border-chalk text-slate hover:border-navy")
                      }
                    >
                      {it.published ? "Published" : "Draft"}
                    </button>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate">{it.version}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${it.title}"?`)) deleteMut.mutate(it.id);
                      }}
                      className="text-slate hover:text-terracotta"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate">
                    No items match the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[12px] text-slate">
        <Link to="/app" className="hover:text-navy">
          ← Back to app
        </Link>
      </p>

      {editing && (
        <ItemEditor
          item={editing === "new" ? null : editing}
          userId={user.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            invalidate();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

interface EditorProps {
  item: LibraryItem | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

function ItemEditor({ item, userId, onClose, onSaved }: EditorProps) {
  const [type, setType] = useState<LibraryType>(item?.type ?? "prompts");
  const [title, setTitle] = useState(item?.title ?? "");
  const [summary, setSummary] = useState(item?.summary ?? "");
  const [moduleIds, setModuleIds] = useState<string[]>(item?.module_ids ?? []);
  const [phaseIds, setPhaseIds] = useState<string[]>(item?.phase_ids ?? []);
  const [tags, setTags] = useState((item?.tags ?? []).join(", "));
  const [published, setPublished] = useState(item?.published ?? false);
  const [contentUrl, setContentUrl] = useState(item?.content_url ?? "");
  const [contentMd, setContentMd] = useState<string>(
    typeof item?.metadata?.content_markdown === "string" ? (item.metadata.content_markdown as string) : "",
  );
  const schema = TYPE_SCHEMAS[type];
  const [metadata, setMetadata] = useState<Record<string, unknown>>(() => {
    const base = { ...(schema.defaultMetadata ?? {}) };
    return { ...base, ...(item?.metadata ?? {}) };
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // when type changes, preserve overlapping keys, fill defaults for new ones
    setMetadata((cur) => ({ ...TYPE_SCHEMAS[type].defaultMetadata, ...cur }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const save = useMutation({
    mutationFn: async () => {
      const arr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
      const meta: Record<string, unknown> = { ...metadata };
      if (contentMd.trim()) meta.content_markdown = contentMd;
      // missing required check
      const missing = schema.fields.filter((f) => f.required && !readField(meta, f.key)).map((f) => f.label);
      if (missing.length) throw new Error(`Required: ${missing.join(", ")}`);
      // file-based: when publishing, require either the type-specific URL or a content URL fallback
      if (published && schema.fileUrlKey) {
        const typeUrl = readField(meta, schema.fileUrlKey);
        const hasTypeUrl = typeof typeUrl === "string" && typeUrl.trim().length > 0;
        const hasContentUrl = contentUrl.trim().length > 0;
        if (!hasTypeUrl && !hasContentUrl) {
          throw new Error(
            `Published ${schema.label.toLowerCase()} needs a "${schema.fields.find((f) => f.key === schema.fileUrlKey)?.label ?? schema.fileUrlKey}" or a Content URL.`,
          );
        }
      }
      const payload = {
        type,
        title: title.trim(),
        summary: summary.trim() || null,
        module_ids: moduleIds,
        phase_ids: phaseIds,
        tags: arr(tags),
        published,
        content_url: contentUrl.trim() || null,
        metadata: meta,
      };
      if (item) return updateLibraryItem(item.id, { ...payload, version: item.version });
      return createLibraryItem(payload, userId);
    },
    onSuccess: () => {
      toast.success(item ? "Updated" : "Created");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const onUpload = async (file: File, target: "content_url" | string) => {
    setUploading(true);
    try {
      const url = await uploadLibraryFile(file, type);
      if (target === "content_url") setContentUrl(url);
      else writeField(metadata, target, url, setMetadata);
      toast.success("Uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/50 p-4">
      <div className="my-8 w-full max-w-[820px] space-y-5 rounded-lg bg-paper p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-medium text-navy">
            {item ? "Edit item" : "New library item"}
          </h2>
          <button onClick={onClose} className="text-[13px] text-slate hover:text-navy">
            Close
          </button>
        </div>

        <Row label="Type">
          <select
            value={type}
            onChange={(e) => isLibraryType(e.target.value) && setType(e.target.value)}
            className="input"
          >
            {LIBRARY_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_SCHEMAS[t].label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
        </Row>
        <Row label="Summary">
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className="input" />
        </Row>
        <Row label="Modules">
          <ChipMultiSelect
            options={MODULES.map((m) => ({ value: m.id, label: `${m.id} · ${m.title}` }))}
            value={moduleIds}
            onChange={setModuleIds}
          />
        </Row>
        <Row label="Phases">
          <ChipMultiSelect
            options={PHASES.map((p) => ({ value: p.id, label: p.name }))}
            value={phaseIds}
            onChange={setPhaseIds}
          />
        </Row>
        <Row label="Tags (comma)">
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="input" />
        </Row>
        <Row label="Content URL">
          <div className="flex items-center gap-2">
            <input value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} className="input flex-1" />
            <FileButton onPick={(f) => onUpload(f, "content_url")} disabled={uploading} />
          </div>
        </Row>
        <Row label="Markdown content">
          <textarea
            value={contentMd}
            onChange={(e) => setContentMd(e.target.value)}
            rows={6}
            className="input font-mono text-[12px]"
            placeholder="Optional markdown content (stored in metadata.content_markdown)"
          />
          {contentMd && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] uppercase tracking-[0.14em] text-slate">
                Preview
              </summary>
              <pre className="mt-2 whitespace-pre-wrap rounded border border-chalk bg-mist p-2 text-[12px] text-navy">
                {contentMd}
              </pre>
            </details>
          )}
        </Row>
        <label className="flex items-center gap-2 text-[13px] text-navy">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published
        </label>

        <div className="space-y-3 rounded-md border border-chalk p-4">
          <p className="eyebrow-muted">TYPE-SPECIFIC FIELDS · {schema.label.toUpperCase()}</p>
          {schema.fields.map((f) => (
            <Row key={f.key} label={f.label + (f.required ? " *" : "")}>
              <MetaInput
                field={f}
                value={readField(metadata, f.key)}
                onChange={(v) => writeField(metadata, f.key, v, setMetadata)}
                onUpload={(file) => onUpload(file, f.key)}
                uploading={uploading}
              />
              {f.help && <p className="mt-1 text-[11px] text-slate">{f.help}</p>}
            </Row>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-chalk px-3 py-2 text-[13px] text-navy hover:bg-mist">
            Cancel
          </button>
          <button
            disabled={save.isPending || !title.trim()}
            onClick={() => save.mutate()}
            className="rounded-md bg-navy px-3 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : item ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-slate">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function FileButton({ onPick, disabled }: { onPick: (file: File) => void; disabled?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-chalk px-2.5 py-1.5 text-[12px] text-navy hover:bg-mist">
      <Upload className="h-3.5 w-3.5" />
      Upload
      <input
        type="file"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function readField(meta: Record<string, unknown>, key: string): unknown {
  if (!key.includes(".")) return meta[key];
  const parts = key.split(".");
  let cur: unknown = meta;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else return undefined;
  }
  return cur;
}

function writeField(
  meta: Record<string, unknown>,
  key: string,
  value: unknown,
  setter: (fn: (cur: Record<string, unknown>) => Record<string, unknown>) => void,
) {
  setter((cur) => {
    const next = { ...cur };
    if (!key.includes(".")) {
      next[key] = value;
      return next;
    }
    const parts = key.split(".");
    let obj: Record<string, unknown> = next;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      const child = obj[p];
      const nestedObj: Record<string, unknown> =
        child && typeof child === "object" ? { ...(child as Record<string, unknown>) } : {};
      obj[p] = nestedObj;
      obj = nestedObj;
    }
    obj[parts[parts.length - 1]] = value;
    return next;
  });
  // unused parameter satisfaction
  void meta;
}

function MetaInput({
  field,
  value,
  onChange,
  onUpload,
  uploading,
}: {
  field: import("@/lib/library/typeSchemas").MetadataField;
  value: unknown;
  onChange: (v: unknown) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const str = typeof value === "string" ? value : value == null ? "" : Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);

  if (field.kind === "textarea") {
    return <textarea value={str} onChange={(e) => onChange(e.target.value)} rows={4} className="input" placeholder={field.placeholder} />;
  }
  if (field.kind === "select") {
    return (
      <select value={str} onChange={(e) => onChange(e.target.value)} className="input">
        <option value="">—</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (field.kind === "number") {
    return (
      <input
        type="number"
        value={str}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="input"
        placeholder={field.placeholder}
      />
    );
  }
  if (field.kind === "tags") {
    const current = Array.isArray(value) ? (value as unknown[]).map((v) => String(v)) : str ? str.split(",").map((s) => s.trim()).filter(Boolean) : [];
    if (field.options && field.options.length > 0) {
      return (
        <ChipMultiSelect
          options={field.options.map((o) => ({ value: o, label: o }))}
          value={current}
          onChange={(next) => onChange(next)}
          allowCustom
          placeholder={field.placeholder}
        />
      );
    }
    return (
      <input
        value={str}
        onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
        placeholder={field.placeholder ?? "comma-separated"}
        className="input"
      />
    );
  }
  if (field.kind === "date") {
    return <input type="date" value={str} onChange={(e) => onChange(e.target.value)} className="input" />;
  }
  if (field.kind === "json") {
    return (
      <textarea
        value={str}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            onChange(e.target.value);
          }
        }}
        rows={4}
        className="input font-mono text-[12px]"
        placeholder={field.placeholder}
      />
    );
  }
  // text or url
  const isFileTarget = field.key === "file_url" || field.key === "video_url" || field.key === "thumbnail_url" || field.key === "transcript_url";
  return (
    <div className="flex items-center gap-2">
      <input
        type={field.kind === "url" ? "url" : "text"}
        value={str}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="input flex-1"
      />
      {isFileTarget && <FileButton onPick={onUpload} disabled={uploading} />}
    </div>
  );
}

function ChipMultiSelect({
  options,
  value,
  onChange,
  allowCustom = false,
  placeholder,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  allowCustom?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  const addCustom = () => {
    const v = draft.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setDraft("");
  };
  const known = new Set(options.map((o) => o.value));
  const custom = value.filter((v) => !known.has(v));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={[
                "rounded-full border px-2.5 py-0.5 text-[12px]",
                active
                  ? "border-terracotta bg-terracotta text-white"
                  : "border-chalk text-slate hover:border-navy hover:text-navy",
              ].join(" ")}
            >
              {o.label}
            </button>
          );
        })}
        {custom.map((v) => (
          <button
            key={`c-${v}`}
            type="button"
            onClick={() => toggle(v)}
            className="rounded-full border border-terracotta bg-terracotta px-2.5 py-0.5 text-[12px] text-white"
            title="Remove"
          >
            {v} ×
          </button>
        ))}
      </div>
      {allowCustom && (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder={placeholder ?? "Add custom…"}
            className="input flex-1"
          />
          <button
            type="button"
            onClick={addCustom}
            className="rounded-md border border-chalk px-2.5 py-1.5 text-[12px] text-navy hover:bg-mist"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
