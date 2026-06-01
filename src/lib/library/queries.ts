import { supabase } from "@/integrations/supabase/client";
import type { LibraryItem, LibraryListFilters, LibraryType } from "./types";

type Row = Omit<LibraryItem, "metadata"> & { metadata: unknown };

function normalize(row: Row): LibraryItem {
  return {
    ...row,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

export async function listLibraryItems(filters: LibraryListFilters = {}): Promise<LibraryItem[]> {
  let q = supabase
    .from("library_items")
    .select("*")
    .is("workspace_id", null)
    .order("created_at", { ascending: false });

  if (!filters.includeUnpublished) q = q.eq("published", true);
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
  return (data ?? []).map((r) => normalize(r as Row));
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
  content_url?: string | null;
  metadata?: Record<string, unknown>;
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
    published: input.published ?? false,
    content_url: input.content_url ?? null,
    metadata: (input.metadata ?? {}) as never,
    workspace_id: null,
    created_by: userId,
  };
  const { data, error } = await supabase.from("library_items").insert(payload).select("*").single();
  if (error) throw error;
  return normalize(data as Row);
}

export async function updateLibraryItem(
  id: string,
  patch: Partial<UpsertLibraryItemInput> & { version: number },
): Promise<LibraryItem> {
  const { version, metadata, ...rest } = patch;
  const update: Record<string, unknown> = { ...rest, version: version + 1 };
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
  const { error } = await supabase.from("library_items").delete().eq("id", id);
  if (error) throw error;
}

export async function setPublished(id: string, published: boolean, version: number): Promise<LibraryItem> {
  return updateLibraryItem(id, { published, version });
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
