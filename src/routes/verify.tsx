import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthCard } from "@/components/AuthCard";

type Search = { return_to?: string };

export const Route = createFileRoute("/verify")({
  component: VerifyPage,
  validateSearch: (s: Record<string, unknown>): Search => ({
    return_to: typeof s.return_to === "string" ? s.return_to : undefined,
  }),
});

function safeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

function VerifyPage() {
  const { user } = useAuth();
  const { return_to } = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      window.location.assign(safeReturnTo(return_to));
    }
  }, [user, return_to, navigate]);

  return (
    <AuthCard
      eyebrow="Verification"
      title={<>Email <span className="accent-italic">verified.</span></>}
      subtitle="You're all set. Log in to continue."
    >
      <Link
        to="/login"
        search={return_to ? { return_to } : undefined}
        className="btn-ichigo btn-ichigo-primary block w-full text-center"
      >
        Go to log in
      </Link>
    </AuthCard>
  );
}
