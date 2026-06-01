import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWorkedExample } from "@/hooks/useAssess";
import {
  type ProfileValues,
  isProfileComplete,
  pruneProfileValues,
} from "@/lib/profile/schema";

export function useUseCaseProfile() {
  const { workspace } = useWorkspace();
  const { data: workedExample } = useWorkedExample();
  const qc = useQueryClient();

  const workedExampleId = workedExample?.id ?? null;

  const query = useQuery({
    enabled: !!workspace && !!workedExampleId,
    queryKey: ["use-case-profile", workspace?.id, workedExampleId],
    queryFn: async (): Promise<ProfileValues | null> => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("use_case_profile")
        .eq("id", workspace!.id)
        .maybeSingle();
      if (error) throw error;
      const blob = (data?.use_case_profile as Record<string, ProfileValues> | null) ?? null;
      if (!blob || !workedExampleId) return null;
      return blob[workedExampleId] ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async (values: ProfileValues) => {
      if (!workspace || !workedExample || !workedExampleId) {
        throw new Error("No workspace or worked example");
      }
      // Fetch existing blob to merge — never blow away other worked-example profiles
      const { data: existing, error: readErr } = await supabase
        .from("workspaces")
        .select("use_case_profile")
        .eq("id", workspace.id)
        .maybeSingle();
      if (readErr) throw readErr;

      const blob: Record<string, ProfileValues> =
        (existing?.use_case_profile as Record<string, ProfileValues> | null) ?? {};
      const pruned = pruneProfileValues(workedExample.useCaseProfileSchema, values);
      blob[workedExampleId] = pruned;

      const { error } = await supabase
        .from("workspaces")
        .update({ use_case_profile: blob })
        .eq("id", workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["use-case-profile", workspace?.id, workedExampleId] });
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    schema: workedExample?.useCaseProfileSchema ?? [],
    defaults: workedExample?.useCaseProfileDefaults ?? {},
    workedExample,
    isComplete:
      query.data && workedExample
        ? isProfileComplete(workedExample.useCaseProfileSchema, query.data)
        : false,
    save,
  };
}
