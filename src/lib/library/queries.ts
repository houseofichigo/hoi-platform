import { supabase } from "@/integrations/supabase/client";
import type {
  LibraryEditorialStatus,
  LibraryItem,
  LibraryItemVersion,
  LibraryListFilters,
  LibraryType,
} from "./types";

type Row = Omit<LibraryItem, "metadata"> & { metadata: unknown };

function normalize(row: Row): LibraryItem {
  return {
    ...row,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

export async function listLibraryItems(filters: LibraryListFilters = {}): Promise<LibraryItem[]> {
  let q: any = supabase
    .from("library_items")
    .select("*")
    .is("workspace_id", null)
    .order("created_at", { ascending: false });

  if (!filters.includeUnpublished) q = q.eq("published", true);
  if (!filters.includeArchived) q = q.neq("editorial_status", "archived");
  if (filters.editorialStatus) q = q.eq("editorial_status", filters.editorialStatus);
  if (filters.type) q = q.eq("type", filters.type);
  if (filters.moduleIds?.length) q = q.overlaps("module_ids", filters.moduleIds);
  if (filters.phaseIds?.length) q = q.overlaps("phase_ids", filters.phaseIds);
  if (filters.tags?.length) q = q.overlaps("tags", filters.tags);
  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%,]/g, " ");
    q = q.or(`title.ilike.%${term}%,summary.ilike.%${term}%`);
  }
  if (filters.limit) q = q.limit(filters.limit);

  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((r) => normalize(r as Row));
}

export async function getLibraryItem(id: string): Promise<LibraryItem | null> {
  const { data, error } = await supabase.from("library_items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? normalize(data as Row) : null;
}

export async function countByType(): Promise<Record<LibraryType, number>> {
  const items = await listLibraryItems({});
  const out = {} as Record<LibraryType, number>;
  for (const it of items) out[it.type] = (out[it.type] ?? 0) + 1;
  return out;
}

export interface UpsertLibraryItemInput {
  id?: string;
  type: LibraryType;
  title: string;
  summary?: string | null;
  module_ids?: string[];
  phase_ids?: string[];
  tags?: string[];
  published?: boolean;
  editorial_status?: LibraryEditorialStatus;
  content_url?: string | null;
  metadata?: Record<string, unknown>;
  content_owner_id?: string | null;
  reviewer_id?: string | null;
  last_reviewed_at?: string | null;
  internal_notes?: string | null;
}

export async function createLibraryItem(
  input: UpsertLibraryItemInput,
  userId: string,
): Promise<LibraryItem> {
  const payload = {
    type: input.type,
    title: input.title,
    summary: input.summary ?? null,
    module_ids: input.module_ids ?? [],
    phase_ids: input.phase_ids ?? [],
    tags: input.tags ?? [],
    published: input.published ?? (input.editorial_status === "published"),
    editorial_status: input.editorial_status ?? (input.published ? "published" : "draft"),
    content_url: input.content_url ?? null,
    metadata: (input.metadata ?? {}) as never,
    workspace_id: null,
    created_by: userId,
    content_owner_id: input.content_owner_id ?? userId,
    reviewer_id: input.reviewer_id ?? null,
    last_reviewed_at: input.last_reviewed_at ?? null,
    internal_notes: input.internal_notes ?? null,
  };
  const { data, error } = await supabase
    .from("library_items")
    .insert(payload as never)
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data as Row);
}

export async function updateLibraryItem(
  id: string,
  patch: Partial<UpsertLibraryItemInput> & { version: number; changed_by?: string | null },
): Promise<LibraryItem> {
  const { version, metadata, changed_by, ...rest } = patch;
  const current = await getLibraryItem(id);
  if (current && changed_by) {
    await (supabase as any).from("library_item_versions").insert({
      library_item_id: id,
      version: current.version,
      snapshot: current as never,
      changed_by,
    } as never);
  }
  const update: Record<string, unknown> = { ...rest, version: version + 1 };
  if (patch.editorial_status) update.published = patch.editorial_status === "published";
  if (metadata !== undefined) update.metadata = metadata;
  const { data, error } = await supabase
    .from("library_items")
    .update(update as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data as Row);
}

export async function deleteLibraryItem(id: string): Promise<void> {
  const current = await getLibraryItem(id);
  if (!current) return;
  await archiveLibraryItem(current);
}

export async function archiveLibraryItem(
  item: LibraryItem,
  changedBy?: string | null,
): Promise<LibraryItem> {
  return updateLibraryItem(item.id, {
    editorial_status: "archived",
    published: false,
    version: item.version,
    changed_by: changedBy,
  });
}

export async function duplicateLibraryItem(item: LibraryItem, userId: string): Promise<LibraryItem> {
  return createLibraryItem(
    {
      type: item.type,
      title: `${item.title} copy`,
      summary: item.summary,
      module_ids: item.module_ids,
      phase_ids: item.phase_ids,
      tags: item.tags,
      editorial_status: "draft",
      published: false,
      content_url: item.content_url,
      metadata: item.metadata,
      content_owner_id: userId,
      internal_notes: item.internal_notes,
    },
    userId,
  );
}

export async function setPublished(id: string, published: boolean, version: number): Promise<LibraryItem> {
  return updateLibraryItem(id, {
    published,
    editorial_status: published ? "published" : "draft",
    version,
  });
}

export async function uploadLibraryFile(file: File, prefix = "uploads"): Promise<string> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("library-files").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("library-files").getPublicUrl(path);
  return data.publicUrl;
}

export async function listLibraryItemVersions(itemId: string): Promise<LibraryItemVersion[]> {
  const { data, error } = await (supabase as any)
    .from("library_item_versions")
    .select("id, library_item_id, version, snapshot, changed_by, created_at")
    .eq("library_item_id", itemId)
    .order("version", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Omit<LibraryItemVersion, "snapshot"> & { snapshot: unknown }>).map((row) => ({
    ...row,
    snapshot: (row.snapshot ?? {}) as LibraryItem,
  }));
}
