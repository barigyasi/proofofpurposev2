import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm uppercase tracking-widest text-primary">popmgm.org</p>
      <h1 className="text-5xl font-bold sm:text-6xl">Proof of Purpose</h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Wallet-primary, on-chain youth impact on Base. Donors fund. Champions earn PURPOSE.
        Vendors redeem. Every step is public.
      </p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link to="/login">Connect Wallet</Link>
        </Button>
      </div>
    </main>
  );
};

export default Index;
