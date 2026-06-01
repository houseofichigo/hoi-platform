import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type HoiAdminRole =
  | "owner"
  | "admin"
  | "content_editor"
  | "support"
  | "billing_admin"
  | "read_only";

export interface HoiAdminAccess {
  isHoiAdmin: boolean;
  role: HoiAdminRole | null;
  loading: boolean;
  canManageAdmins: boolean;
  canManageContent: boolean;
  canManageBilling: boolean;
  canSupportCustomers: boolean;
}

export function useHoiAdmin(): HoiAdminAccess {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["hoi-admin", user?.id],
    queryFn: async (): Promise<{ role: HoiAdminRole } | null> => {
      const { data, error } = await (supabase as any)
        .from("hoi_admin_users")
        .select("role")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data as { role: HoiAdminRole } | null;
    },
  });

  const role = data?.role ?? null;
  const isHoiAdmin = !!role;
  const elevated = role === "owner" || role === "admin";

  return {
    isHoiAdmin,
    role,
    loading: isLoading,
    canManageAdmins: role === "owner" || role === "admin",
    canManageContent: elevated || role === "content_editor",
    canManageBilling: elevated || role === "billing_admin",
    canSupportCustomers: elevated || role === "support",
  };
}
