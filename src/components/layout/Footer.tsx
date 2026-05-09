import { useRef, useState } from "react";
import { AdminEntryDialog } from "@/components/auth/AdminEntryDialog";

export function Footer() {
  const [open, setOpen] = useState(false);
  const clicks = useRef<number[]>([]);

  function handleSecretClick() {
    const now = Date.now();
    clicks.current = [...clicks.current, now].filter((t) => now - t < 1500);
    if (clicks.current.length >= 3) {
      clicks.current = [];
      setOpen(true);
    }
  }

  return (
    <>
      <footer className="border-t-2 border-foreground bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            // popmgm.org
            {" "}
            <button
              type="button"
              onClick={handleSecretClick}
              aria-label="."
              tabIndex={-1}
              className="bg-transparent text-muted-foreground outline-none focus:outline-none"
              style={{ all: "unset", cursor: "default" }}
            >
              ·
            </button>
            {" "}
            base mainnet · v0.1
          </p>
        </div>
      </footer>
      <AdminEntryDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
