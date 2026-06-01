import { useHoiAdmin } from "@/hooks/useHoiAdmin";

export function useSuperAdmin() {
  const admin = useHoiAdmin();
  return {
    isSuperAdmin: admin.role === "owner" || admin.role === "admin",
    loading: admin.loading,
  };
}
