import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** Allows only the listed roles. Bounces unauthenticated → /login, mismatched → /dashboard. */
export function RoleGate({
  anyOf,
  children,
}: {
  anyOf: AppRole[];
  children: React.ReactNode;
}) {
  const { session, roles, isLoading } = useSessionRoles();
  const navigate = useNavigate();
  const toasted = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }
    if (!roles.some((r) => anyOf.includes(r))) {
      if (!toasted.current) {
        toasted.current = true;
        toast.error("Members only");
      }
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, session, roles, anyOf, navigate]);

  if (isLoading || !session) return null;
  if (!roles.some((r) => anyOf.includes(r))) return null;
  return <>{children}</>;
}
