import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWorkspaceProfile } from "@/hooks/useWorkspaceProfile";
import { useUserProfile } from "@/hooks/useUserProfile";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PersonalFieldsForm } from "@/components/profile/PersonalFieldsForm";
import { WORKSPACE_PROFILE_DEFAULTS } from "@/lib/profile/workspace-profile";
import type { ProfileValues } from "@/lib/profile/schema";

const searchSchema = z.object({ return_to: z.string().optional() });

export const Route = createFileRoute("/app/$workspaceSlug/onboarding/workspace-profile")({
  component: WorkspaceProfileOnboarding,
  validateSearch: searchSchema,
});

function WorkspaceProfileOnboarding() {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const search = useSearch({ from: "/app/$workspaceSlug/onboarding/workspace-profile" });
  const { data, isLoading, isComplete, schema, save } = useWorkspaceProfile();
  const { data: userData, save: saveUser } = useUserProfile();

  const [jobRole, setJobRole] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    setJobRole(userData?.job_role ?? "");
    setDepartment(userData?.department ?? "");
  }, [userData?.job_role, userData?.department]);

  if (!workspace) return null;

  const isEditing = isComplete;

  const initial: ProfileValues = {
    ...(WORKSPACE_PROFILE_DEFAULTS as ProfileValues),
    ...(data ?? {}),
  };

  const handleSubmit = async (values: ProfileValues) => {
    try {
      try {
        await saveUser.mutateAsync({ job_role: jobRole, department });
      } catch (err) {
        toast.error((err as Error).message ?? "Could not save personal details.");
      }
      await save.mutateAsync(values);
      toast.success(isEditing ? "Profile updated." : "Profile saved.");
      const returnTo = search.return_to;
      if (returnTo && returnTo.startsWith("/")) {
        navigate({ to: returnTo });
      } else {
        navigate({
          to: "/app/$workspaceSlug",
          params: { workspaceSlug: workspace.slug },
        });
      }
    } catch (err) {
      toast.error((err as Error).message ?? "Could not save profile.");
    }
  };

  return (
    <div className="mx-auto max-w-[640px] py-8">
      <p className="eyebrow-muted">
        <Link
          to="/app/$workspaceSlug"
          params={{ workspaceSlug: workspace.slug }}
          className="hover:text-navy"
        >
          ← WORKSPACE
        </Link>{" "}
        · ONBOARDING · COMPANY PROFILE
      </p>

      <div className="mt-4">
        <h1 className="h-display-md">
          {isEditing ? (
            <>Edit your <span className="accent-italic">company profile.</span></>
          ) : (
            <>Tell us about <span className="accent-italic">you and your company.</span></>
          )}
        </h1>
        <p className="lead mt-4 max-w-[60ch] text-[15px]">
          {isEditing
            ? "Update the details below. Every example in your training is regenerated from these values."
            : "Every example in your training is generated from your real context — no fictional profile. A few quick questions, takes a minute, edit any time from settings."}
        </p>
      </div>

      <div className="card mt-10">
        <p className="eyebrow-muted">About you</p>
        <p className="mt-2 text-[13px] text-graphite">
          Optional — helps teammates recognise you and tailors examples to your role.
        </p>
        <div className="mt-5">
          <PersonalFieldsForm
            jobRole={jobRole}
            department={department}
            onJobRoleChange={setJobRole}
            onDepartmentChange={setDepartment}
          />
        </div>
      </div>

      <div className="card mt-6">
        <p className="eyebrow-muted">About your company</p>
        <div className="mt-5">
          {isLoading ? (
            <p className="text-[14px] text-slate">Loading…</p>
          ) : (
            <ProfileForm
              schema={schema}
              initialValues={initial}
              onSubmit={handleSubmit}
              submitting={save.isPending || saveUser.isPending}
              submitLabel={isEditing ? "Save changes" : "Save and continue"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
