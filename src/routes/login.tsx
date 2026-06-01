import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AuthCard } from "@/components/AuthCard";

type Search = { reset?: "success"; return_to?: string; invited_email?: string };

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (s: Record<string, unknown>): Search => ({
    reset: s.reset === "success" ? "success" : undefined,
    return_to: typeof s.return_to === "string" ? s.return_to : undefined,
    invited_email: typeof s.invited_email === "string" ? s.invited_email : undefined,
  }),
});

function safeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { reset, return_to, invited_email } = Route.useSearch();
  const [email, setEmail] = useState(invited_email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (reset === "success") toast.success("Password updated. Please log in.");
  }, [reset]);

  useEffect(() => {
    if (user) {
      const dest = safeReturnTo(return_to);
      window.location.assign(dest);
    }
  }, [user, return_to]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await signIn(email, password);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    const dest = safeReturnTo(return_to);
    window.location.assign(dest);
  };

  return (
    <AuthCard
      eyebrow="Log in"
      title={<>Welcome <span className="accent-italic">back.</span></>}
      subtitle={
        invited_email
          ? `Log in as ${invited_email} to accept your workspace invitation.`
          : "Continue where you left off."
      }
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
          {invited_email && email.toLowerCase() !== invited_email.toLowerCase() && (
            <p className="mt-1.5 text-[12px] text-terracotta">
              This invitation was sent to {invited_email}. Use that email to join the workspace.
            </p>
          )}
        </label>
        <label className="block">
          <span className="text-[13px] font-medium text-navy">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input-ichigo mt-1.5"
          />
        </label>
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-ichigo btn-ichigo-primary w-full">
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <div className="mt-6 flex items-center justify-between text-[13px]">
        <Link to="/forgot-password" className="text-azure hover:underline">Forgot password?</Link>
        <Link
          to="/signup"
          search={
            return_to
              ? { return_to, invited_email }
              : invited_email
                ? { invited_email }
                : undefined
          }
          className="text-azure hover:underline"
        >
          Sign up
        </Link>
      </div>
    </AuthCard>
  );
}
