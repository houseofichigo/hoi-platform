import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    enabled: !!user,
    queryKey: ["app-index-bootstrap", user?.id],
    queryFn: async () => {
      const [membersRes, profileRes] = await Promise.all([
        supabase
          .from("workspace_members")
          .select("workspace_id, joined_at, workspaces!inner(id, slug)")
          .eq("user_id", user!.id)
          .order("joined_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("default_workspace_id")
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);
      if (membersRes.error) throw membersRes.error;
      if (profileRes.error) throw profileRes.error;
      return {
        memberships: membersRes.data ?? [],
        defaultWorkspaceId: profileRes.data?.default_workspace_id ?? null,
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    if (data.memberships.length === 0) {
      navigate({ to: "/app/onboarding/create-workspace" });
      return;
    }
    const preferred =
      data.memberships.find((m: any) => m.workspace_id === data.defaultWorkspaceId) ??
      data.memberships[0];
    const slug = (preferred as any).workspaces?.slug;
    if (slug) navigate({ to: "/app/$workspaceSlug", params: { workspaceSlug: slug } });
  }, [data, navigate]);

  useEffect(() => {
    if (error) toast.error((error as Error).message);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{isLoading ? "Loading…" : "Redirecting…"}</p>
    </div>
  );
}
