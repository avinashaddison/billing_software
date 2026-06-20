import { Component, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Props { children: ReactNode }
interface State { hasError: boolean }

/**
 * Last-resort safety net. Without this, any uncaught render error tears the
 * whole React tree down to a blank white page with no way out. This catches
 * it and shows a recoverable screen instead (reload, or bounce to login —
 * the common cause is rendering the app against an expired session).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("App crashed:", error);
  }

  private reload = () => {
    window.location.reload();
  };

  private relogin = () => {
    try { useAuth.getState().logout(); } catch { /* ignore */ }
    window.location.assign(`${BASE_URL}/login`);
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center bg-background">
        <div className="text-5xl">😵</div>
        <div>
          <p className="text-xl font-black text-foreground">Something went wrong</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
            The app hit an unexpected error. Reloading usually fixes it. If it
            keeps happening, log in again.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={this.reload}
            className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-sm">
            Reload
          </button>
          <button onClick={this.relogin}
            className="px-5 py-2.5 rounded-full border font-bold text-sm text-foreground">
            Log in again
          </button>
        </div>
      </div>
    );
  }
}
