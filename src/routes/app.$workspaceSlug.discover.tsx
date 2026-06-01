import { Outlet, createFileRoute } from "@tanstack/react-router";
import { DiscoverLayout } from "@/components/library/DiscoverLayout";

export const Route = createFileRoute("/app/$workspaceSlug/discover")({
  component: () => (
    <DiscoverLayout>
      <Outlet />
    </DiscoverLayout>
  ),
});
