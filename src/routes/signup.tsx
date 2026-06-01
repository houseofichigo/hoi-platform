import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AuthCard } from "@/components/AuthCard";

type Search = { invited_email?: string; return_to?: string };

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  validateSearch: (s: Record<string, unknown>): Search => ({
    invited_email: typeof s.invited_email === "string" ? s.invited_email : undefined,
    return_to: typeof s.return_to === "string" ? s.return_to : undefined,
  }),
});

function safeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

function SignupPage() {
  const { signUp } = useAuth();
  const { invited_email, return_to } = Route.useSearch();
  const [email, setEmail] = useState(invited_email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const emailLocked = !!invited_email;
  const dest = safeReturnTo(return_to);

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
    // Pass return_to via the email verification redirect so the user lands back here after verifying.
    const { error: err } = await signUp(email, password, dest);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    toast.success("Account created. Check your email.");
  };

  if (done) {
    return (
      <AuthCard
        eyebrow="Verification"
        title={<>Check your <span className="accent-italic">email.</span></>}
        subtitle={`We sent a verification link to ${email}. Click it to activate your account.`}
      >
        <Link to="/login" search={return_to ? { return_to } : undefined} className="text-[13px] text-azure hover:underline">
          Back to log in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Sign up"
      title={<>Create your <span className="accent-italic">account.</span></>}
      subtitle={
        emailLocked
          ? `Complete your account for ${invited_email} to join the workspace.`
          : "Start your AI transformation. Set up takes under a minute."
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
            readOnly={emailLocked}
            className={`input-ichigo mt-1.5 ${emailLocked ? "cursor-not-allowed opacity-70" : ""}`}
          />
        </label>
        <Field label="Password" type="password" value={password} onChange={setPassword} required minLength={8} />
        <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} required minLength={8} />
        {error && <p className="text-[13px] text-destructive">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-ichigo btn-ichigo-primary w-full">
          {submitting ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="mt-6 text-[13px] text-graphite">
        Already have an account?{" "}
        <Link to="/login" search={return_to ? { return_to } : undefined} className="text-azure hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}

function Field({ label, type, value, onChange, required, minLength }: { label: string; type: string; value: string; onChange: (v: string) => void; required?: boolean; minLength?: number }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-navy">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        className="input-ichigo mt-1.5"
      />
    </label>
  );
}
