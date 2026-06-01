import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/hooks/useAuth";
import { PersonalFieldsForm } from "@/components/profile/PersonalFieldsForm";

export function UserProfileCard() {
  const { user } = useAuth();
  const { data, isComplete, save } = useUserProfile();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    setFullName(data?.full_name ?? "");
    setAvatarUrl(data?.avatar_url ?? "");
    setJobRole(data?.job_role ?? "");
    setDepartment(data?.department ?? "");
  }, [data?.full_name, data?.avatar_url, data?.job_role, data?.department]);

  const onSave = async () => {
    if (!fullName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    try {
      await save.mutateAsync({
        full_name: fullName,
        avatar_url: avatarUrl,
        job_role: jobRole,
        department: department,
      });
      toast.success("Profile updated.");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile.");
    }
  };

  const onCancel = () => {
    setFullName(data?.full_name ?? "");
    setAvatarUrl(data?.avatar_url ?? "");
    setJobRole(data?.job_role ?? "");
    setDepartment(data?.department ?? "");
    setEditing(false);
  };

  return (
    <div className="card mt-6 max-w-[560px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow-muted">Your profile</p>
          <p className="mt-2 text-[14px] text-graphite">
            {isComplete
              ? "Your personal details shown to teammates."
              : "Add your name so teammates recognise you in this workspace."}
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 text-[13px] font-medium text-terracotta transition-opacity hover:opacity-80"
          >
            {isComplete ? "Edit →" : "Set up →"}
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="mt-5 divide-y divide-chalk border-t border-chalk">
          <Row label="Full name" value={data?.full_name?.trim() || "—"} />
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Job role" value={data?.job_role?.trim() || "—"} />
          <Row label="Department" value={data?.department?.trim() || "—"} />
          <div className="grid grid-cols-3 gap-3 py-3">
            <dt className="text-[12px] font-mono uppercase tracking-[0.16em] text-slate">
              Avatar
            </dt>
            <dd className="col-span-2 flex items-center gap-3 text-[14px] text-navy">
              {data?.avatar_url ? (
                <img
                  src={data.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full border border-chalk object-cover"
                />
              ) : null}
              <span className="truncate text-graphite">{data?.avatar_url || "—"}</span>
            </dd>
          </div>
        </dl>
      ) : (
        <div className="mt-5 space-y-4 border-t border-chalk pt-5">
          <div>
            <label className="text-[12px] font-mono uppercase tracking-[0.16em] text-slate">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              className="mt-2 w-full rounded-md border border-chalk bg-white px-3 py-2 text-[14px] text-navy focus:border-terracotta focus:outline-none"
            />
          </div>
          <PersonalFieldsForm
            jobRole={jobRole}
            department={department}
            onJobRoleChange={setJobRole}
            onDepartmentChange={setDepartment}
            variant="card"
          />
          <div>
            <label className="text-[12px] font-mono uppercase tracking-[0.16em] text-slate">
              Avatar URL (optional)
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className="mt-2 w-full rounded-md border border-chalk bg-white px-3 py-2 text-[14px] text-navy focus:border-terracotta focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onSave}
              disabled={save.isPending}
              className="rounded-md bg-terracotta px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={save.isPending}
              className="text-[13px] font-medium text-graphite transition-opacity hover:opacity-80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-3">
      <dt className="text-[12px] font-mono uppercase tracking-[0.16em] text-slate">{label}</dt>
      <dd className="col-span-2 text-[14px] text-navy">{value}</dd>
    </div>
  );
}
