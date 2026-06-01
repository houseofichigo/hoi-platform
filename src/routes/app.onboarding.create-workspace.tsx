import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import logoNavy from "@/assets/logos/logo-navy-mark.png";

export const Route = createFileRoute("/app/onboarding/create-workspace")({
  component: CreateWorkspacePage,
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function CreateWorkspacePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const validate = () => {
    const next: { name?: string; slug?: string } = {};
    if (!name.trim()) next.name = "Workspace name is required.";
    if (!slug) next.slug = "Workspace slug is required.";
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
      next.slug = "Only lowercase letters, numbers, and hyphens.";
    else if (slug.length < 3 || slug.length > 40)
      next.slug = "Slug must be 3-40 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validate()) return;
    setSubmitting(true);
    try {
      const { data: ws, error: rpcErr } = await supabase
        .rpc("create_workspace", { p_name: name.trim(), p_slug: slug })
        .single<{ id: string; slug: string }>();

      if (rpcErr) {
        const code = (rpcErr as any).code;
        if (code === "23505") {
          setErrors({ slug: "That workspace slug is already taken. Try another." });
          return;
        }
        if (code === "23514") {
          setErrors({
            slug: "Invalid workspace slug. Use lowercase letters, numbers, and single hyphens only.",
          });
          return;
        }
        throw rpcErr;
      }

      await queryClient.invalidateQueries({ queryKey: ["app-index-bootstrap"] });
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });

      navigate({ to: "/app/$workspaceSlug", params: { workspaceSlug: ws!.slug } });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create workspace.");
    } finally {
      setSubmitting(false);
    }
  };

  const onLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="relative min-h-screen bg-paper">
      <header className="h-16 border-b border-chalk bg-paper">
        <div className="mx-auto flex h-full max-w-[1080px] items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <img src={logoNavy} alt="House of Ichigo" className="h-7 w-7" />
            <span className="text-[13px] font-medium text-navy">House of Ichigo</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[13px] text-slate sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-navy transition-colors hover:bg-mist"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-[560px] rounded-lg border border-chalk bg-white p-10">
          <p className="eyebrow">Welcome · Step 01</p>
          <h1 className="h-display-md mt-3">
            Create your <span className="accent-italic">workspace.</span>
          </h1>
          <p className="lead mt-4 text-[15px]">
            Workspaces are where your team's AI work lives — use cases, roadmaps, learning
            progress, and documentation, all scoped to one team.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="name" className="block text-[13px] font-medium text-navy">
                Workspace name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                autoFocus
                className="input-ichigo mt-1.5"
              />
              {errors.name && <p className="mt-1.5 text-[12px] text-destructive">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="slug" className="block text-[13px] font-medium text-navy">
                Workspace slug
              </label>
              <input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                placeholder="acme-corp"
                className="input-ichigo mt-1.5 font-mono text-[14px]"
              />
              {errors.slug && <p className="mt-1.5 text-[12px] text-destructive">{errors.slug}</p>}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-ichigo btn-ichigo-primary w-full"
            >
              {submitting ? "Creating…" : "Create workspace"}
            </button>
          </form>
        </div>
      </div>

      <p className="ichigo-footer absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
        Equipped to <span className="accent">run.</span>
      </p>
    </div>
  );
}
