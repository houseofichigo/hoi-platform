import { Outlet, createFileRoute } from "@tanstack/react-router";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";

export const Route = createFileRoute("/app/$workspaceSlug")({
  component: WorkspaceRouteLayout,
});

function WorkspaceRouteLayout() {
  return (
    <WorkspaceProvider>
      <WorkspaceLayout>
        <Outlet />
      </WorkspaceLayout>
    </WorkspaceProvider>
  );
}
