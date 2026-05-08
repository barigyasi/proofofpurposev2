import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type Signup = {
  id: string;
  name: string;
  city: string;
  email: string;
  created_at: string;
};

export default function AdminWaitlist() {
  const navigate = useNavigate();
  const { session, roles, isLoading } = useSessionRoles();
  const { toast } = useToast();
  const [rows, setRows] = useState<Signup[] | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!session) navigate("/login", { replace: true });
    else if (!roles.includes("admin")) navigate("/dashboard", { replace: true });
  }, [isLoading, session, roles, navigate]);

  useEffect(() => {
    if (!roles.includes("admin")) return;
    supabase
      .from("waitlist_signups")
      .select("id,name,city,email,created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "Failed to load waitlist", description: error.message, variant: "destructive" });
          setRows([]);
          return;
        }
        setRows((data ?? []) as Signup[]);
      });
  }, [roles, toast]);

  function exportCsv() {
    if (!rows?.length) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = "name,city,email,created_at\n";
    const body = rows
      .map((r) => [r.name, r.city, r.email, r.created_at].map(esc).join(","))
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading || !session || !roles.includes("admin")) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 border-b-2 border-foreground pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            // pre-launch signups
          </p>
          <h1 className="mt-3 font-display text-5xl sm:text-6xl">
            WAIT<span className="text-primary">LIST</span>
          </h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {rows == null ? "loading…" : `${rows.length} total`}
          </p>
        </div>
        <Button
          onClick={exportCsv}
          disabled={!rows?.length}
          className="brutal-primary brutal-hover h-auto px-6 py-3 font-display"
        >
          EXPORT CSV
        </Button>
      </div>

      {rows && rows.length === 0 && (
        <div className="brutal mt-10 p-10 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            // empty
          </p>
          <p className="mt-3 font-display text-2xl">No signups yet.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="brutal mt-10 overflow-x-auto">
          <table className="w-full border-collapse font-mono text-sm">
            <thead>
              <tr className="border-b-2 border-foreground bg-secondary">
                <th className="px-4 py-3 text-left text-xs uppercase tracking-widest">Name</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-widest">City</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-widest">Email</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-widest">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-foreground/20">
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.city}</td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${r.email}`} className="underline">{r.email}</a>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
