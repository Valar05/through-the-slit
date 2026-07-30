"use client";

import { lazy, Suspense, useEffect, useState } from "react";

const GameClient = lazy(() => import("./game-client"));

export default function BrowserShell() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <main className="game-shell" aria-label="Loading Through the Slit" />;
  }

  return (
    <Suspense fallback={<main className="game-shell" aria-label="Loading Through the Slit" />}>
      <GameClient />
    </Suspense>
  );
}
