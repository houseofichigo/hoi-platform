import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminPageHeader, AdminShell, AdminStat } from "@/components/admin/AdminShell";
import { listLibraryItems } from "@/lib/library/queries";

export const Route = createFileRoute("/admin/content")({
  component: AdminContent,
});

function AdminContent() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["library", "admin", "content-ops"],
    queryFn: () => listLibraryItems({ includeUnpublished: true }),
  });

  const counts = data.reduce(
    (acc, item) => {
      const status = item.editorial_status ?? (item.published ? "published" : "draft");
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const needsReview = data.filter((item) => item.editorial_status === "in_review");
  const stalePublished = data.filter((item) => item.editorial_status === "published" && !item.last_reviewed_at);

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="ADMIN · CONTENT OPS"
        title="Editorial operations."
        lead="A lightweight operating view over the global Discover library: drafts, review queue, and published content that still needs review metadata."
      />

      {isLoading ? (
        <p className="text-[13px] text-slate">Loading content operations…</p>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          {(error as Error).message}
        </p>
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <AdminStat label="Draft" value={counts.draft ?? 0} />
            <AdminStat label="In review" value={counts.in_review ?? 0} />
            <AdminStat label="Published" value={counts.published ?? 0} />
            <AdminStat label="Archived" value={counts.archived ?? 0} />
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Queue title="Review queue" items={needsReview.map((i) => i.title)} empty="No items in review." />
            <Queue
              title="Published without review date"
              items={stalePublished.map((i) => i.title)}
              empty="All published items have review metadata."
            />
          </section>

          <a href="/admin/library" className="btn-ichigo btn-ichigo-primary inline-flex">
            Open Library CMS
          </a>
        </div>
      )}
    </AdminShell>
  );
}

function Queue({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-md border border-chalk bg-white p-5">
      <p className="eyebrow-muted">{title}</p>
      {items.length === 0 ? (
        <p className="mt-4 text-[13px] text-slate">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-chalk">
          {items.map((item) => (
            <li key={item} className="py-2 text-[14px] text-navy">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
