import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const { error: err } = await updatePassword(password);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate({ to: "/login", search: { reset: "success" } });
  };

  return (
    <AuthCard
      eyebrow="Reset password"
      title={<>Set a new <span className="accent-italic">password.</span></>}
      subtitle="Choose something memorable."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-[13px] font-medium text-navy">New password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="input-ichigo mt-1.5"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium text-navy">Confirm new password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            className="input-ichigo mt-1.5"
          />
        </label>
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-ichigo btn-ichigo-primary w-full">
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthCard>
  );
}
