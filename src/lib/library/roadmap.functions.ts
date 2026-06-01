import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AddToRoadmapInput = z.object({
  workspaceId: z.string().uuid(),
  libraryItemId: z.string().uuid(),
});

const ALLOWED_FUNCTIONS = new Set([
  "finance",
  "operations",
  "sales",
  "marketing",
  "customer_success",
  "customer_ops",
  "hr",
  "procurement",
  "legal",
  "it",
  "product",
  "other",
]);

function safeFunction(value: unknown): string {
  return typeof value === "string" && ALLOWED_FUNCTIONS.has(value) ? value : "other";
}

export const addLibraryItemToRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => AddToRoadmapInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: membership, error: memErr } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    const isAdmin = membership?.role === "owner" || membership?.role === "admin";
    if (!isAdmin) {
      return { ok: false as const, code: "not_admin", message: "Only workspace admins can add Discover assets to the roadmap." };
    }

    const { data: item, error: itemErr } = await supabaseAdmin
      .from("library_items")
      .select("id, type, title, summary, tags, phase_ids, metadata, published")
      .eq("id", data.libraryItemId)
      .maybeSingle();
    if (itemErr) throw new Error(itemErr.message);
    if (!item || !item.published) {
      return { ok: false as const, code: "not_found", message: "Published library item not found." };
    }

    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    const fn = safeFunction(metadata.function);
    const { data: useCase, error: useCaseErr } = await supabaseAdmin
      .from("use_cases")
      .insert({
        workspace_id: data.workspaceId,
        created_by: userId,
        name: item.title,
        function: fn,
        description: item.summary ?? `Roadmap item sourced from Discover ${item.type}.`,
        status: "draft",
        lifecycle_state: "idea",
      } as never)
      .select("id, name")
      .single();
    if (useCaseErr) throw new Error(useCaseErr.message);

    const sourceMetadata = {
      source: "discover_library",
      library_item_id: item.id,
      library_item_type: item.type,
      framework_relevance: metadata.framework_relevance ?? metadata.framework ?? null,
      risk_metadata: {
        tags: item.tags ?? [],
        phase_ids: item.phase_ids ?? [],
        maturity_level: metadata.maturity_level ?? null,
        entity_type: metadata.entity_type ?? null,
      },
    };

    const { data: entry, error: entryErr } = await supabaseAdmin
      .from("roadmap_entries")
      .insert({
        workspace_id: data.workspaceId,
        use_case_id: useCase.id,
        stage: "backlog",
        priority_score: null,
        created_by: userId,
        source_metadata: sourceMetadata,
        evidence_summary: {
          source: "Discover",
          next_evidence: ["Assign owner", "Define KPI", "Capture process detail", "Run Build scoring"],
        },
      } as never)
      .select("id")
      .single();
    if (entryErr) throw new Error(entryErr.message);

    await supabaseAdmin.from("audit_log").insert({
      workspace_id: data.workspaceId,
      actor_id: userId,
      action_type: "discover_item_added_to_roadmap",
      entity_type: "roadmap_entry",
      entity_id: entry.id,
      entity_label: useCase.name,
      metadata: {
        use_case_id: useCase.id,
        library_item_id: item.id,
        source: "discover_library",
      },
    } as never);

    return { ok: true as const, useCaseId: useCase.id, roadmapEntryId: entry.id };
  });
