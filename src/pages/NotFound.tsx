import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Seo } from "@/components/Seo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-4xl flex-col justify-center px-4 py-16 sm:px-6">
      <Seo
        title="404 — Proof of Purpose"
        description="The page you were looking for is off-chain. Head back to base."
        path={location.pathname}
      />
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        // error 404 · {location.pathname}
      </p>
      <h1 className="mt-4 font-display text-[22vw] leading-[0.85] text-primary sm:text-[180px]">
        404
      </h1>
      <p className="mt-6 max-w-xl font-display text-3xl sm:text-4xl">
        THIS PAGE IS<br />
        <span className="text-primary">OFF-CHAIN.</span>
      </p>
      <p className="mt-3 max-w-xl font-mono text-xs uppercase tracking-widest text-muted-foreground">
        // nothing here. nothing minted. nothing burned.
      </p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          to="/"
          className="brutal-primary brutal-hover inline-flex items-center px-8 py-5 font-display text-xl"
        >
          ← HOME
        </Link>
        <Link
          to="/donate"
          className="brutal brutal-hover inline-flex items-center px-8 py-5 font-display text-xl"
        >
          DONATE
        </Link>
        <Link
          to="/governance"
          className="brutal brutal-hover inline-flex items-center px-8 py-5 font-display text-xl"
        >
          GOVERNANCE
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
