import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportClientError } from "@/lib/clientObservability";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled application error", error, info.componentStack);
    reportClientError("render", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="not-found" role="alert">
          <p className="eyebrow">Something went wrong</p>
          <h1>Gambitron could not continue</h1>
          <p>Your saved games are still stored on this device.</p>
          <button type="button" className="btn-ghost" onClick={() => window.location.assign("/")}>
            Return to a new game
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
