import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useUseCases, useCreateUseCase } from "@/hooks/useBuild";

export const Route = createFileRoute("/app/$workspaceSlug/build/capture/")({
  component: CaptureIndex,
});

const FUNCTIONS: { value: string; label: string }[] = [
  { value: "operations", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "customer_success", label: "Customer Success" },
  { value: "customer_ops", label: "Customer Ops" },
  { value: "hr", label: "HR" },
  { value: "procurement", label: "Procurement" },
  { value: "legal", label: "Legal" },
  { value: "it", label: "IT" },
  { value: "product", label: "Product" },
  { value: "other", label: "Other" },
];

function CaptureIndex() {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const { data: useCases = [] } = useUseCases();
  const create = useCreateUseCase();
  const [name, setName] = useState("");
  const [fn, setFn] = useState("operations");
  const [desc, setDesc] = useState("");

  if (!workspace) return null;

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Give your use case a name");
      return;
    }
    try {
      const uc = await create.mutateAsync({ name: name.trim(), function: fn, description: desc.trim() || undefined });
      toast.success("Use case created");
      navigate({
        to: "/app/$workspaceSlug/build/capture/$useCaseId",
        params: { workspaceSlug: workspace.slug, useCaseId: uc.id },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Failed to create";
      toast.error(msg);
    }
  };

  const inFlight = useCases.filter((u) => ["draft", "capturing"].includes(u.status));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
      <section className="card">
        <p className="eyebrow">START A NEW USE CASE</p>
        <h2 className="mt-2 h-display-sm">Describe the process</h2>
        <p className="mt-2 text-[13px] text-graphite">
          Give it a clear name and pick the business function. You'll complete the full capture in the next step.
        </p>
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-[12px] font-medium text-navy">Use case name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Invoice approval triage"
              className="mt-1 w-full rounded-md border border-chalk bg-paper px-3 py-2 text-[14px] outline-none focus:border-terracotta"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-navy">Function</span>
            <select
              value={fn}
              onChange={(e) => setFn(e.target.value)}
              className="mt-1 w-full rounded-md border border-chalk bg-paper px-3 py-2 text-[14px]"
            >
              {FUNCTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-navy">One-line description (optional)</span>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="What does this process do?"
              className="mt-1 w-full rounded-md border border-chalk bg-paper px-3 py-2 text-[14px] outline-none focus:border-terracotta"
            />
          </label>
          <button
            onClick={submit}
            disabled={create.isPending}
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-terracotta px-4 py-2 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {create.isPending ? "Creating…" : "Create and start capture"}
          </button>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow-muted">IN PROGRESS</p>
        <h3 className="mt-2 font-display text-[18px] text-navy">Continue a draft</h3>
        {inFlight.length === 0 ? (
          <p className="mt-3 text-[13px] text-graphite">No drafts in flight.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {inFlight.slice(0, 6).map((u) => (
              <li key={u.id}>
                <Link
                  to="/app/$workspaceSlug/build/capture/$useCaseId"
                  params={{ workspaceSlug: workspace.slug, useCaseId: u.id }}
                  className="flex items-center justify-between rounded-md border border-chalk bg-paper px-3 py-2 hover:border-terracotta"
                >
                  <div>
                    <p className="text-[14px] font-medium text-navy">{u.name}</p>
                    <p className="text-[11px] text-graphite">{u.function}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-terracotta" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
