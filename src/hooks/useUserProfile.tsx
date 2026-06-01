import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type UserProfileValues = {
  full_name: string | null;
  avatar_url: string | null;
  job_role: string | null;
  department: string | null;
};

export function useUserProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    enabled: !!user,
    queryKey: ["user-profile", user?.id],
    queryFn: async (): Promise<UserProfileValues | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, job_role, department")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async (values: Partial<UserProfileValues>) => {
      if (!user) throw new Error("Not authenticated");
      const payload: Partial<UserProfileValues> = {};
      if (values.full_name !== undefined) payload.full_name = values.full_name?.trim() || null;
      if (values.avatar_url !== undefined) payload.avatar_url = values.avatar_url?.trim() || null;
      if (values.job_role !== undefined) payload.job_role = values.job_role?.trim() || null;
      if (values.department !== undefined) payload.department = values.department?.trim() || null;
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["onboarding-checklist"] });
    },
  });

  const fullName = query.data?.full_name?.trim() ?? "";
  return {
    data: query.data,
    isLoading: query.isLoading,
    isComplete: fullName.length > 0,
    save,
  };
}
