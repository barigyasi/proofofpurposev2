import { useRef, useState } from "react";
import { Link } from "react-router-dom";
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
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
          <nav className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <Link to="/impact" className="hover:text-primary">impact</Link>
            <Link to="/vendors" className="hover:text-primary">vendors</Link>
            <Link to="/governance/past" className="hover:text-primary">past props</Link>
            <Link to="/about" className="hover:text-primary">about</Link>
            <Link to="/about/whitepaper" className="hover:text-primary">whitepaper</Link>
          </nav>
        </div>
      </footer>
      <AdminEntryDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
