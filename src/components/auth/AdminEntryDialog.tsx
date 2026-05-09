import { useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConnectWalletButton } from "@/components/auth/ConnectWalletButton";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminEntryDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session: Session | null) => {
      if (!session) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (data) {
        onOpenChange(false);
        navigate("/admin");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [open, onOpenChange, navigate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-2 border-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">ADMIN ENTER</DialogTitle>
          <DialogDescription className="font-mono text-xs uppercase tracking-widest">
            // staff only · allowlisted wallets
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Connect your admin wallet (MetaMask / Coinbase / WalletConnect) to access mission control.
        </p>
        <div className="mt-2">
          <ConnectWalletButton mode="admin" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
