import type { Database } from "@/integrations/supabase/types";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { useRoleView } from "@/context/RoleViewContext";

type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * For admins, allows previewing the app as another role via the header switcher.
 * Non-admins always see their real roles.
 */
export function useEffectiveRoles() {
  const { session, roles, isLoading } = useSessionRoles();
  const { viewAs } = useRoleView();

  const isRealAdmin = roles.includes("admin");
  const isAdminPreview = isRealAdmin && viewAs !== "admin";

  let effectiveRoles: AppRole[] = roles;
  if (isAdminPreview) {
    effectiveRoles = viewAs === "donor" ? [] : [viewAs as AppRole];
  }

  return {
    session,
    roles: effectiveRoles,
    realRoles: roles,
    isAdminPreview,
    viewAs,
    isLoading,
  };
}
