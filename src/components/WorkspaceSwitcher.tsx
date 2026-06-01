import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Plus, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WorkspaceListItem {
  workspace_id: string;
  workspaces: { id: string; name: string; slug: string } | null;
}

export function WorkspaceSwitcher() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();

  const { data: workspaces = [] } = useQuery({
    enabled: !!user,
    queryKey: ["workspaces", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces!inner(id, name, slug)")
        .eq("user_id", user!.id)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as WorkspaceListItem[];
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[15px] font-medium text-navy transition-colors hover:bg-mist"
        >
          <span className="max-w-[200px] truncate">{workspace?.name ?? "Select workspace"}</span>
          <ChevronDown className="h-4 w-4 text-slate" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 rounded-lg border-chalk bg-white p-1 shadow-[0_4px_20px_rgba(30,43,77,0.08)]">
        {workspaces.map((m) => {
          const ws = m.workspaces;
          if (!ws) return null;
          const isActive = workspace?.id === ws.id;
          return (
            <DropdownMenuItem
              key={ws.id}
              onSelect={() =>
                navigate({ to: "/app/$workspaceSlug", params: { workspaceSlug: ws.slug } })
              }
              className="flex cursor-pointer items-center justify-between text-[14px] text-navy focus:bg-mist focus:text-navy"
            >
              <span className="truncate">{ws.name}</span>
              {isActive && <Check className="h-4 w-4 text-terracotta" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator className="bg-chalk" />
        <DropdownMenuItem
          onSelect={() => navigate({ to: "/app/onboarding/create-workspace" })}
          className="cursor-pointer text-[14px] text-terracotta focus:bg-mist focus:text-terracotta"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create new workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
