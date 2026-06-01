import { createFileRoute, notFound } from "@tanstack/react-router";
import { DiscoverTypePage } from "@/components/library/DiscoverTypePage";
import { getSchemaBySlug } from "@/lib/library/typeSchemas";

export const Route = createFileRoute("/app/$workspaceSlug/discover/$")({
  component: DiscoverTypeRoute,
  notFoundComponent: () => (
    <div className="card border-l-[3px] border-l-terracotta">
      <p className="text-[14px] text-navy">That library category does not exist.</p>
    </div>
  ),
});

function DiscoverTypeRoute() {
  const { _splat } = Route.useParams();
  const slug = (_splat ?? "").split("/")[0];
  const schema = getSchemaBySlug(slug);
  if (!schema) throw notFound();
  return <DiscoverTypePage type={schema.id} />;
}
