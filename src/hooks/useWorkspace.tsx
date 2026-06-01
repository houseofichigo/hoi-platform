import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

interface WorkspaceContextValue {
  workspace: Workspace | null;
  role: string | null;
  isOwner: boolean;
  isAdmin: boolean;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug?: string };
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    enabled: !!user && !!workspaceSlug,
    queryKey: ["workspace", workspaceSlug, user?.id],
    queryFn: async () => {
      const { data: ws, error: wsErr } = await supabase
        .from("workspaces")
        .select("id, name, slug, plan")
        .eq("slug", workspaceSlug!)
        .maybeSingle();
      if (wsErr) throw wsErr;
      if (!ws) return { workspace: null, role: null };

      const { data: member, error: mErr } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", ws.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (mErr) throw mErr;
      if (!member) return { workspace: null, role: null };

      return { workspace: ws as Workspace, role: member.role as string };
    },
  });

  useEffect(() => {
    if (isLoading || !user) return;
    if (data && !data.workspace) {
      navigate({ to: "/app" });
    }
  }, [data, isLoading, user, navigate]);

  useEffect(() => {
    if (error) toast.error((error as Error).message);
  }, [error]);

  const workspace = data?.workspace ?? null;
  const role = data?.role ?? null;

  const value: WorkspaceContextValue = {
    workspace,
    role,
    isOwner: role === "owner",
    isAdmin: role === "owner" || role === "admin",
    loading: isLoading,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}
