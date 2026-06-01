import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await resetPassword(email);
    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    return (
      <AuthCard
        eyebrow="Reset password"
        title={<>Check your <span className="accent-italic">email.</span></>}
        subtitle="If that email exists, we've sent a reset link."
      >
        <Link to="/login" className="text-[13px] text-azure hover:underline">Back to log in</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Reset password"
      title={<>Reset your <span className="accent-italic">password.</span></>}
      subtitle="We'll send you a link."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-[13px] font-medium text-navy">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-ichigo mt-1.5"
          />
        </label>
        <button type="submit" disabled={submitting} className="btn-ichigo btn-ichigo-primary w-full">
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-6 text-[13px] text-graphite">
        <Link to="/login" className="text-azure hover:underline">Back to log in</Link>
      </p>
    </AuthCard>
  );
}
