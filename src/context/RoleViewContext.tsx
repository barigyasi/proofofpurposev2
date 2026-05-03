import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ViewAs = "admin" | "champion" | "vendor" | "catalyst" | "donor";

const KEY = "pop:viewAs";

type Ctx = { viewAs: ViewAs; setViewAs: (v: ViewAs) => void };
const RoleViewContext = createContext<Ctx>({ viewAs: "admin", setViewAs: () => {} });

export function RoleViewProvider({ children }: { children: ReactNode }) {
  const [viewAs, setViewAsState] = useState<ViewAs>(() => {
    if (typeof window === "undefined") return "admin";
    return ((sessionStorage.getItem(KEY) as ViewAs) || "admin");
  });
  useEffect(() => {
    try { sessionStorage.setItem(KEY, viewAs); } catch { /* ignore */ }
  }, [viewAs]);
  return (
    <RoleViewContext.Provider value={{ viewAs, setViewAs: setViewAsState }}>
      {children}
    </RoleViewContext.Provider>
  );
}

export function useRoleView() {
  return useContext(RoleViewContext);
}
