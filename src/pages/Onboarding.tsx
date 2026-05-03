import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Heart, Building2, Store, Trophy } from "lucide-react";
import { useSessionRoles } from "@/hooks/useSessionRoles";

const CHOICES = [
  {
    to: "/donate",
    icon: Heart,
    tag: "donor",
    title: "FUND THE MISSION",
    body: "Donate USDC to youth doing real work. No account required to give.",
  },
  {
    to: "/apply/catalyst",
    icon: Building2,
    tag: "catalyst",
    title: "REPRESENT AN ORG",
    body: "Apply as a Catalyst — propose bounties for the youth in your community.",
  },
  {
    to: "/apply/vendor",
    icon: Store,
    tag: "vendor",
    title: "ACCEPT $PURPOSE",
    body: "Apply as a vendor — let champions spend tokens on goods + services.",
  },
  {
    to: "/dashboard?as=champion",
    icon: Trophy,
    tag: "champion",
    title: "EARN $PURPOSE",
    body: "I'm a young person ready to complete bounties + earn rewards.",
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { session, roles, isLoading } = useSessionRoles();
  const [acknowledged, setAcknowledged] = useState(false);

  // If they already have any meaningful role, send them to the right home
  useEffect(() => {
    if (isLoading || acknowledged) return;
    if (!session) return;
    if (roles.includes("admin")) navigate("/admin", { replace: true });
    else if (roles.includes("vendor")) navigate("/vendor", { replace: true });
    else if (roles.includes("catalyst")) navigate("/catalyst", { replace: true });
  }, [isLoading, session, roles, navigate, acknowledged]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // welcome · pick your path
        </p>
        <h1 className="mt-3 font-display text-5xl sm:text-7xl">
          WHAT BRINGS<br />
          <span className="text-primary">YOU HERE?</span>
        </h1>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          You're signed in. Choose how you want to participate — you can change this
          anytime.
        </p>
      </div>

      <section className="mt-10 grid gap-5 sm:grid-cols-2">
        {CHOICES.map(({ to, icon: Icon, tag, title, body }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setAcknowledged(true)}
            className="brutal brutal-hover group block p-6"
          >
            <div className="flex items-center justify-between">
              <Icon className="h-8 w-8 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {tag}
              </span>
            </div>
            <h3 className="mt-4 font-display text-3xl">{title}</h3>
            <p className="mt-3 text-sm text-muted-foreground">{body}</p>
            <p className="mt-4 font-display text-xs text-primary">CONTINUE →</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
