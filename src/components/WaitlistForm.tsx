import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  city: z.string().trim().min(1, "City is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
});

export function WaitlistForm() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const parsed = schema.safeParse({ name, city, email });
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Check your inputs";
      toast({ title: "Hold up", description: first, variant: "destructive" });
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("waitlist_signups").insert({
      name: parsed.data.name,
      city: parsed.data.city,
      email: parsed.data.email.toLowerCase(),
    });
    setBusy(false);

    if (error) {
      // 23505 = unique violation
      if ((error as { code?: string }).code === "23505") {
        setDone(true);
        toast({ title: "You're already on the list ✓", description: "We'll be in touch soon." });
        return;
      }
      toast({
        title: "Something went wrong",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setDone(true);
    toast({ title: "You're on the list ✓", description: "We'll let you know when we launch." });
  }

  if (done) {
    return (
      <div className="brutal-primary p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-primary-foreground/80">
          // confirmed
        </p>
        <h3 className="mt-3 font-display text-4xl text-primary-foreground sm:text-5xl">
          YOU'RE ON THE LIST
        </h3>
        <p className="mt-3 text-sm text-primary-foreground/90">
          We'll email you the moment Proof of Purpose opens up.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="brutal p-6 sm:p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        // join the waitlist
      </p>
      <h3 className="mt-3 font-display text-4xl sm:text-5xl">
        BE FIRST<br />IN LINE
      </h3>
      <p className="mt-3 text-sm text-muted-foreground">
        v2 contracts launching soon. Drop your info and we'll let you know the
        moment donors, champions, and vendors can come on board.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <Label htmlFor="wl-name" className="font-mono text-xs uppercase tracking-widest">
            Name
          </Label>
          <Input
            id="wl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="mt-2 border-2 border-foreground"
            placeholder="Your name"
          />
        </div>
        <div className="sm:col-span-1">
          <Label htmlFor="wl-city" className="font-mono text-xs uppercase tracking-widest">
            City
          </Label>
          <Input
            id="wl-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            maxLength={100}
            className="mt-2 border-2 border-foreground"
            placeholder="Where you're based"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="wl-email" className="font-mono text-xs uppercase tracking-widest">
            Email
          </Label>
          <Input
            id="wl-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={255}
            className="mt-2 border-2 border-foreground"
            placeholder="you@domain.com"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={busy}
        className="brutal-primary brutal-hover mt-6 h-auto px-8 py-5 font-display text-xl"
      >
        {busy ? "JOINING…" : "JOIN THE WAITLIST →"}
      </Button>
    </form>
  );
}
