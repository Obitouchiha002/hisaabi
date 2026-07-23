import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Ek JS error se poori app safed ho jati thi — user ko sirf khaali screen dikhta,
 * na wajah, na koi rasta. Paise wali app me wo darawna hai: lagta hai data hi
 * ud gaya (jabki data phone me safe hota hai).
 *
 * Ab error aaye to saaf message aur do rasta: dobara try, ya app reload.
 */

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Ye console me hi rehta hai — kahin bheja nahi jata
    console.error('[hisaabi] screen crash:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="app">
        <div className="screen crash">
          <span className="crash-ico" aria-hidden="true">😕</span>
          <h1>Kuch gadbad ho gayi</h1>
          <p>
            Ye screen khul nahi payi. <b>Tumhara data bilkul safe hai</b> —
            wo phone me hi pada hai, kahin gaya nahi.
          </p>

          <details className="crash-why">
            <summary>Kya hua tha?</summary>
            <code>{error.message || String(error)}</code>
          </details>

          <div className="q-foot">
            <button className="btn btn-primary btn-block" onClick={() => this.setState({ error: null })}>
              Dobara try karo
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => location.reload()}>
              App dobara kholo
            </button>
          </div>
        </div>
      </div>
    );
  }
}
