import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Archive, Copy, Eye, History, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useHoiAdmin } from "@/hooks/useHoiAdmin";
import { AdminNotesPanel } from "@/components/admin/AdminNotesPanel";
import { AdminPageHeader, AdminShell } from "@/components/admin/AdminShell";
import {
  archiveLibraryItem,
  createLibraryItem,
  duplicateLibraryItem,
  listLibraryItemVersions,
  listLibraryItems,
  updateLibraryItem,
  uploadLibraryFile,
} from "@/lib/library/queries";
import { TYPE_LIST, TYPE_SCHEMAS } from "@/lib/library/typeSchemas";
import type { LibraryEditorialStatus, LibraryItem, LibraryItemVersion, LibraryType } from "@/lib/library/types";
import { isLibraryType, LIBRARY_TYPES } from "@/lib/library/types";
import { MODULES, PHASES } from "@/lib/curriculum";

export const Route = createFileRoute("/admin/library")({
  component: AdminLibrary,
});

function AdminLibrary() {
  const { user } = useAuth();
  const admin = useHoiAdmin();
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<LibraryType | "">("");
  const [statusFilter, setStatusFilter] = useState<"all" | LibraryEditorialStatus>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<LibraryItem | "new" | null>(null);
  const [previewing, setPreviewing] = useState<LibraryItem | null>(null);
  const [versioning, setVersioning] = useState<LibraryItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    enabled: admin.isHoiAdmin,
    queryKey: ["library", "admin", "all"],
    queryFn: () => listLibraryItems({ includeUnpublished: true, includeArchived: true }),
  });

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (typeFilter && it.type !== typeFilter) return false;
      if (statusFilter !== "all" && (it.editorial_status ?? (it.published ? "published" : "draft")) !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [it.title, it.summary ?? "", it.tags.join(" ")].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, typeFilter, statusFilter, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["library"] });
  };

  const archiveMut = useMutation({
    mutationFn: (it: LibraryItem) => archiveLibraryItem(it, user?.id),
    onSuccess: () => {
      toast.success("Archived");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const duplicateMut = useMutation({
    mutationFn: (it: LibraryItem) => duplicateLibraryItem(it, user!.id),
    onSuccess: (it) => {
      toast.success(`Duplicated "${it.title}"`);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const setStatus = useMutation({
    mutationFn: (args: { item: LibraryItem; editorial_status: LibraryEditorialStatus }) => {
      if (args.editorial_status === "published") {
        assertPublishable({
          type: args.item.type,
          title: args.item.title,
          summary: args.item.summary,
          moduleIds: args.item.module_ids,
          phaseIds: args.item.phase_ids,
          metadata: args.item.metadata,
          contentUrl: args.item.content_url,
        });
      }
      return updateLibraryItem(args.item.id, {
        editorial_status: args.editorial_status,
        version: args.item.version,
        changed_by: user?.id,
      });
    },
    onSuccess: () => {
      toast.success("Status updated");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="ADMIN · LIBRARY CMS"
        title="Manage the HOI library."
        lead="Create, review, publish, archive, and version the global content that powers Discover."
        action={
          admin.canManageContent && (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-2 text-[13px] font-medium text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> New item
            </button>
          )
        }
      />

      <div className="space-y-6">
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-md border border-chalk bg-paper px-2.5 py-1.5 text-[13px] text-navy outline-none"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="in_review">In review</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
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
                <th className="px-3 py-2 text-left">Editorial status</th>
                <th className="px-3 py-2 text-left">Review</th>
                <th className="px-3 py-2 text-left">v</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const status = it.editorial_status ?? (it.published ? "published" : "draft");
                return (
                  <tr key={it.id} className="border-t border-chalk text-navy">
                    <td className="px-3 py-2">
                      <button onClick={() => setEditing(it)} className="hover:text-terracotta">
                        {it.title}
                      </button>
                    </td>
                    <td className="px-3 py-2">{TYPE_SCHEMAS[it.type].label}</td>
                    <td className="px-3 py-2">
                      {admin.canManageContent ? (
                        <select
                          value={status}
                          onChange={(e) =>
                            setStatus.mutate({
                              item: it,
                              editorial_status: e.target.value as LibraryEditorialStatus,
                            })
                          }
                          className="rounded-md border border-chalk bg-paper px-2 py-1 text-[12px]"
                        >
                          <option value="draft">Draft</option>
                          <option value="in_review">In review</option>
                          <option value="published">Published</option>
                          <option value="archived">Archived</option>
                        </select>
                      ) : (
                        <StatusPill status={status} />
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate">
                      {it.last_reviewed_at ? new Date(it.last_reviewed_at).toLocaleDateString() : "Not reviewed"}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate">{it.version}</td>
                    <td className="px-3 py-2 text-right">
                      {admin.canManageContent && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setPreviewing(it)}
                            className="text-slate hover:text-navy"
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setVersioning(it)}
                            className="text-slate hover:text-navy"
                            title="Version history"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => duplicateMut.mutate(it)}
                            className="text-slate hover:text-navy"
                            title="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Archive "${it.title}"?`)) archiveMut.mutate(it);
                            }}
                            className="text-slate hover:text-terracotta"
                            title="Archive"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate">
                    No items match the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && admin.canManageContent && user && (
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
      {previewing && <LibraryPreview item={previewing} onClose={() => setPreviewing(null)} />}
      {versioning && <VersionHistory item={versioning} onClose={() => setVersioning(null)} />}
      </div>
    </AdminShell>
  );
}

function LibraryPreview({ item, onClose }: { item: LibraryItem; onClose: () => void }) {
  const markdown = typeof item.metadata.content_markdown === "string" ? item.metadata.content_markdown : "";
  const status = item.editorial_status ?? (item.published ? "published" : "draft");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/50 p-4">
      <div className="my-8 w-full max-w-[900px] space-y-5 rounded-lg bg-paper p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-muted">LIBRARY PREVIEW · {TYPE_SCHEMAS[item.type].label.toUpperCase()}</p>
            <h2 className="mt-2 text-[22px] font-medium text-navy">{item.title}</h2>
            {item.summary && <p className="mt-1 max-w-2xl text-[13px] leading-6 text-slate">{item.summary}</p>}
          </div>
          <button onClick={onClose} className="text-[13px] text-slate hover:text-navy">
            Close
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <PreviewFact label="Status" value={status.replace("_", " ")} />
          <PreviewFact label="Version" value={`v${item.version}`} />
          <PreviewFact label="Updated" value={new Date(item.updated_at).toLocaleDateString()} />
          <PreviewFact label="Last reviewed" value={item.last_reviewed_at ? new Date(item.last_reviewed_at).toLocaleDateString() : "Not reviewed"} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {markdown ? (
              <section className="rounded-md border border-chalk bg-mist p-4">
                <p className="eyebrow-muted">MARKDOWN CONTENT</p>
                <pre className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-navy">{markdown}</pre>
              </section>
            ) : (
              <section className="rounded-md border border-dashed border-chalk p-4 text-[13px] text-slate">
                No inline markdown content is stored for this item.
              </section>
            )}

            {item.content_url && (
              <section className="rounded-md border border-chalk p-4">
                <p className="eyebrow-muted">CONTENT FILE OR URL</p>
                <a href={item.content_url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-[13px] text-terracotta hover:underline">
                  {item.content_url}
                </a>
              </section>
            )}

            <section className="rounded-md border border-chalk p-4">
              <p className="eyebrow-muted">TYPE-SPECIFIC METADATA</p>
              <pre className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap rounded bg-mist p-3 text-[12px] text-navy">
                {JSON.stringify(item.metadata, null, 2)}
              </pre>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-md border border-chalk p-4">
              <p className="eyebrow-muted">MAPPING</p>
              <TagBlock label="Modules" values={item.module_ids} />
              <TagBlock label="Phases" values={item.phase_ids} />
              <TagBlock label="Tags" values={item.tags} />
            </section>
            {item.internal_notes && (
              <section className="rounded-md border border-chalk p-4">
                <p className="eyebrow-muted">INTERNAL EDITORIAL NOTES</p>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-slate">{item.internal_notes}</p>
              </section>
            )}
            <AdminNotesPanel entityType="library_item" entityId={item.id} title="Admin notes" />
          </div>
        </div>
      </div>
    </div>
  );
}

function VersionHistory({ item, onClose }: { item: LibraryItem; onClose: () => void }) {
  const { data: versions = [], isLoading } = useQuery<LibraryItemVersion[]>({
    queryKey: ["library", "versions", item.id],
    queryFn: () => listLibraryItemVersions(item.id),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/50 p-4">
      <div className="my-8 w-full max-w-[760px] space-y-5 rounded-lg bg-paper p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-muted">VERSION HISTORY</p>
            <h2 className="mt-2 text-[20px] font-medium text-navy">{item.title}</h2>
            <p className="mt-1 text-[13px] text-slate">
              The current item is v{item.version}. Previous snapshots are captured whenever an admin edits the item.
            </p>
          </div>
          <button onClick={onClose} className="text-[13px] text-slate hover:text-navy">
            Close
          </button>
        </div>

        <div className="rounded-md border border-chalk bg-mist p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-navy">Current version</p>
              <p className="text-[12px] text-slate">v{item.version} · {new Date(item.updated_at).toLocaleString()}</p>
            </div>
            <StatusPill status={item.editorial_status ?? (item.published ? "published" : "draft")} />
          </div>
        </div>

        {isLoading ? (
          <p className="text-[13px] text-slate">Loading version history...</p>
        ) : versions.length === 0 ? (
          <div className="rounded-md border border-dashed border-chalk p-6 text-center text-[13px] text-slate">
            No previous versions yet. The first snapshot is created when this item is edited.
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map((version) => (
              <details key={version.id} className="rounded-md border border-chalk p-4">
                <summary className="cursor-pointer">
                  <span className="font-medium text-navy">v{version.version}</span>
                  <span className="ml-2 text-[12px] text-slate">
                    {new Date(version.created_at).toLocaleString()}
                  </span>
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-[13px] font-medium text-navy">{version.snapshot.title}</p>
                    {version.snapshot.summary && (
                      <p className="mt-1 text-[12px] leading-5 text-slate">{version.snapshot.summary}</p>
                    )}
                  </div>
                  <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded bg-mist p-3 text-[12px] text-navy">
                    {JSON.stringify(version.snapshot, null, 2)}
                  </pre>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-chalk p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate">{label}</p>
      <p className="mt-1 text-[13px] font-medium text-navy">{value}</p>
    </div>
  );
}

function TagBlock({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="mt-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate">{label}</p>
      {values.length ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span key={value} className="rounded-full border border-chalk px-2 py-0.5 text-[11px] text-navy">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[12px] text-slate">None</p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="rounded-full border border-chalk px-2 py-0.5 text-[11px] text-slate">
      {status.replace("_", " ")}
    </span>
  );
}

function publishingIssues(input: {
  type: LibraryType;
  title: string;
  summary: string | null;
  moduleIds: string[];
  phaseIds: string[];
  metadata: Record<string, unknown>;
  contentUrl: string | null;
}) {
  const schema = TYPE_SCHEMAS[input.type];
  const issues: string[] = [];
  if (!input.title.trim()) issues.push("title");
  if (!input.summary?.trim()) issues.push("summary");
  if (input.moduleIds.length === 0 && input.phaseIds.length === 0) {
    issues.push("at least one module or phase mapping");
  }
  for (const field of schema.fields) {
    if (field.required && !readField(input.metadata, field.key)) {
      issues.push(field.label);
    }
  }
  if (schema.fileUrlKey) {
    const typeUrl = readField(input.metadata, schema.fileUrlKey);
    const hasTypeUrl = typeof typeUrl === "string" && typeUrl.trim().length > 0;
    const hasContentUrl = !!input.contentUrl?.trim();
    if (!hasTypeUrl && !hasContentUrl) {
      issues.push(schema.fields.find((f) => f.key === schema.fileUrlKey)?.label ?? schema.fileUrlKey);
    }
  }
  return Array.from(new Set(issues));
}

function assertPublishable(input: Parameters<typeof publishingIssues>[0]) {
  const issues = publishingIssues(input);
  if (issues.length) {
    throw new Error(`Before publishing, add ${issues.join(", ")}.`);
  }
}

/*
 * Editor implementation below remains local because every library type has
 * unique metadata fields and the modal needs direct access to TYPE_SCHEMAS.
 */

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
  const [editorialStatus, setEditorialStatus] = useState<LibraryEditorialStatus>(
    item?.editorial_status ?? (item?.published ? "published" : "draft"),
  );
  const [internalNotes, setInternalNotes] = useState(item?.internal_notes ?? "");
  const [lastReviewedAt, setLastReviewedAt] = useState(
    item?.last_reviewed_at ? item.last_reviewed_at.slice(0, 10) : "",
  );
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
      if (editorialStatus === "published") {
        assertPublishable({
          type,
          title,
          summary,
          moduleIds,
          phaseIds,
          metadata: meta,
          contentUrl,
        });
      }
      const payload = {
        type,
        title: title.trim(),
        summary: summary.trim() || null,
        module_ids: moduleIds,
        phase_ids: phaseIds,
        tags: arr(tags),
        published: editorialStatus === "published",
        editorial_status: editorialStatus,
        content_url: contentUrl.trim() || null,
        metadata: meta,
        internal_notes: internalNotes.trim() || null,
        last_reviewed_at: lastReviewedAt ? new Date(`${lastReviewedAt}T00:00:00Z`).toISOString() : null,
      };
      if (item) return updateLibraryItem(item.id, { ...payload, version: item.version, changed_by: userId });
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
        <Row label="Editorial status">
          <select
            value={editorialStatus}
            onChange={(e) => setEditorialStatus(e.target.value as LibraryEditorialStatus)}
            className="input"
          >
            <option value="draft">Draft</option>
            <option value="in_review">In review</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <p className="mt-1 text-[11px] text-slate">
            Discover only shows items with Published status.
          </p>
        </Row>
        <Row label="Last reviewed">
          <input
            type="date"
            value={lastReviewedAt}
            onChange={(e) => setLastReviewedAt(e.target.value)}
            className="input"
          />
        </Row>
        <Row label="Internal notes">
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={3}
            className="input"
            placeholder="Private editorial notes for House of Ichigo admins"
          />
        </Row>

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
