import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSessionRoles } from "@/hooks/useSessionRoles";

/**
 * Wraps admin-only routes. Bounces non-admins to /dashboard with a toast
 * and unauthenticated visitors to /login. Defense-in-depth on top of RLS.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { session, roles, isLoading } = useSessionRoles();
  const navigate = useNavigate();
  const toasted = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }
    if (!roles.includes("admin")) {
      if (!toasted.current) {
        toasted.current = true;
        toast.error("Admins only");
      }
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, session, roles, navigate]);

  if (isLoading || !session || !roles.includes("admin")) return null;
  return <>{children}</>;
}
