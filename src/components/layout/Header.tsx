import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Menu, X, Eye } from "lucide-react";
import { useActiveWallet, useDisconnect } from "thirdweb/react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { useRoleView, type ViewAs } from "@/context/RoleViewContext";

const NAV = [
  { to: "/vendors", label: "Vendors" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/governance", label: "Governance" },
  { to: "/bulletin", label: "Bulletin" },
  { to: "/about", label: "About" },
  { to: "/donate", label: "Donate" },
];

export function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const { theme, setTheme } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { roles } = useSessionRoles();
  const { viewAs, setViewAs } = useRoleView();
  const isAdmin = roles.includes("admin");
  const isPreview = isAdmin && viewAs !== "admin";

  function handleViewChange(v: ViewAs) {
    setViewAs(v);
    if (v === "admin") navigate("/admin");
    else if (v === "champion") navigate("/dashboard?as=champion");
    else if (v === "vendor") navigate("/vendor");
    else if (v === "catalyst") navigate("/catalyst");
    else if (v === "donor") navigate("/donate");
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await supabase.auth.signOut().catch((e) => console.warn("signOut", e));
      if (wallet) {
        try {
          await disconnect(wallet);
        } catch (e) {
          console.warn("wallet disconnect", e);
        }
      }
    } finally {
      setBusy(false);
      setOpen(false);
      navigate("/", { replace: true });
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b-2 border-foreground bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center bg-primary text-primary-foreground font-display text-lg">
            P
          </span>
          <span className="font-display text-lg leading-none sm:text-xl">
            PROOF<br className="hidden sm:inline" /> OF PURPOSE
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "px-3 py-2 font-display text-sm",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Select value={viewAs} onValueChange={(v) => handleViewChange(v as ViewAs)}>
              <SelectTrigger className="hidden h-9 w-[170px] border-2 border-foreground font-mono text-[11px] uppercase tracking-widest sm:inline-flex">
                <Eye className="mr-1 h-3 w-3" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">View: Admin</SelectItem>
                <SelectItem value="champion">View: Champion</SelectItem>
                <SelectItem value="vendor">View: Vendor</SelectItem>
                <SelectItem value="catalyst">View: Catalyst</SelectItem>
                <SelectItem value="donor">View: Donor</SelectItem>
              </SelectContent>
            </Select>
          )}
          {session ? (
            <Button
              onClick={logout}
              disabled={busy}
              className="hidden font-display brutal-primary brutal-hover sm:inline-flex"
            >
              {busy ? "BYE…" : "LOGOUT"}
            </Button>
          ) : (
            <Button asChild className="hidden font-display brutal-primary brutal-hover sm:inline-flex">
              <Link to="/login">ENTER</Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="border-2 border-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="border-2 border-foreground md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {isPreview && (
        <div className="border-t-2 border-primary bg-primary/10 px-4 py-2 text-center font-mono text-[11px] uppercase tracking-widest text-primary sm:px-6">
          // preview mode · viewing as {viewAs} ·{" "}
          <button onClick={() => handleViewChange("admin")} className="underline">exit</button>
        </div>
      )}

      {open && (
        <div className="border-t-2 border-foreground md:hidden">
          <nav className="flex flex-col">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="border-b border-foreground px-4 py-3 font-display text-base"
              >
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <div className="border-b border-foreground p-3">
                <Select value={viewAs} onValueChange={(v) => { handleViewChange(v as ViewAs); setOpen(false); }}>
                  <SelectTrigger className="h-10 w-full border-2 border-foreground font-mono text-xs uppercase">
                    <Eye className="mr-1 h-3 w-3" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">View: Admin</SelectItem>
                    <SelectItem value="champion">View: Champion</SelectItem>
                    <SelectItem value="vendor">View: Vendor</SelectItem>
                    <SelectItem value="catalyst">View: Catalyst</SelectItem>
                    <SelectItem value="donor">View: Donor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {session ? (
              <button
                onClick={logout}
                disabled={busy}
                className="bg-primary px-4 py-3 text-left font-display text-base text-primary-foreground"
              >
                {busy ? "BYE…" : "LOGOUT"}
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="bg-primary px-4 py-3 font-display text-base text-primary-foreground"
              >
                ENTER
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
