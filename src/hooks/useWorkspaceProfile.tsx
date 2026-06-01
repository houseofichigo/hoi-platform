import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  WORKSPACE_PROFILE_SCHEMA,
  WORKSPACE_PROFILE_DEFAULTS,
} from "@/lib/profile/workspace-profile";
import {
  type ProfileValues,
  isProfileComplete,
  pruneProfileValues,
} from "@/lib/profile/schema";

export function useWorkspaceProfile() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();

  const query = useQuery({
    enabled: !!workspace,
    queryKey: ["workspace-profile", workspace?.id],
    queryFn: async (): Promise<ProfileValues | null> => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("workspace_profile")
        .eq("id", workspace!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.workspace_profile as ProfileValues | null) ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async (values: ProfileValues) => {
      if (!workspace) throw new Error("No workspace");
      const pruned = pruneProfileValues(WORKSPACE_PROFILE_SCHEMA, values);
      const { error } = await supabase
        .from("workspaces")
        .update({ workspace_profile: pruned })
        .eq("id", workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-profile", workspace?.id] });
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isComplete: query.data ? isProfileComplete(WORKSPACE_PROFILE_SCHEMA, query.data) : false,
    schema: WORKSPACE_PROFILE_SCHEMA,
    defaults: WORKSPACE_PROFILE_DEFAULTS,
    save,
  };
}
