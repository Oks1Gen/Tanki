import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("ErrorBoundary:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-dvh w-screen items-center justify-center bg-[#0b0f09] p-8">
          <div className="ui-panel max-w-lg p-8 text-center">
            <div className="ui-kicker">Критическая ошибка</div>
            <h2 className="stencil mt-2 text-3xl text-red-500">Сбой системы</h2>
            <p className="mt-4 text-sm text-lime-200/60">{this.state.error?.message ?? "Неизвестная ошибка"}</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="ui-button-primary mt-6 px-5 py-3 stencil">Перезагрузить</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
