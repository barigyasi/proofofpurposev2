import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSessionRoles } from "@/hooks/useSessionRoles";

/**
 * Requires an authenticated session (i.e. a connected smart wallet or admin EOA).
 * Sends unauthenticated visitors to /login with a return-to redirect.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useSessionRoles();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirect}`, { replace: true });
    }
  }, [isLoading, session, navigate, location]);

  if (isLoading || !session) return null;
  return <>{children}</>;
}
