"use client";

import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useState,
} from "react";

function StartupFailure({ detail = "The observation port did not open." }) {
  return (
    <main className="game-shell" aria-label="Through the Slit startup failed">
      <section className="briefing startup-failure" role="alert">
        <p className="eyebrow">LANDSHIP SYSTEMS</p>
        <h1>
          THROUGH
          <br />
          THE SLIT
        </h1>
        <p>{detail}</p>
        <button type="button" onClick={() => window.location.reload()}>
          REOPEN THE PORT
        </button>
      </section>
    </main>
  );
}

function LoadingBriefing({ stage = "Opening the observation port…" }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 6500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="game-shell" aria-label="Loading Through the Slit">
      <section className="briefing">
        <p className="eyebrow">LANDSHIP SYSTEMS</p>
        <h1>
          THROUGH
          <br />
          THE SLIT
        </h1>
        <p>{slow ? `${stage} The port is resisting.` : stage}</p>
        {slow ? (
          <button type="button" onClick={() => window.location.reload()}>
            REOPEN THE PORT
          </button>
        ) : null}
      </section>
    </main>
  );
}

class StartupBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Through the Slit startup failed", error, info.componentStack);
  }

  render() {
    return this.state.error ? (
      <StartupFailure detail={`The landship answered, then failed: ${this.state.error.message}`} />
    ) : (
      this.props.children
    );
  }
}

export default function BrowserShell() {
  const [GameClient, setGameClient] = useState<ComponentType | null>(null);
  const [stage, setStage] = useState("Opening the observation port…");
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setFailure("The landship did not finish waking. The failed stage has been isolated for retry.");
      }
    }, 15000);

    const boot = async () => {
      try {
        setStage("Loading the landship systems…");
        const game = await import("./game-client");
        if (cancelled) return;
        window.clearTimeout(timeout);
        setGameClient(() => game.default);
      } catch (error) {
        console.error("Through the Slit boot pipeline failed", error);
        if (!cancelled) {
          window.clearTimeout(timeout);
          setFailure("The landship failed to answer during startup.");
        }
      }
    };

    void boot();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  if (failure) return <StartupFailure detail={failure} />;
  if (!GameClient) return <LoadingBriefing stage={stage} />;

  return (
    <StartupBoundary>
      <GameClient />
    </StartupBoundary>
  );
}
