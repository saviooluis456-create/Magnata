import { Component, useEffect, type ReactNode } from 'react';
import { useEditor } from '../store/editor';
import Editor from './Editor';
import Home from './Home';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(error); }
  render() {
    if (this.state.error) {
      return (
        <div className="home" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <h2>Algo deu errado</h2>
            <p className="hint">{this.state.error.message}</p>
            <p className="hint">Seu projeto foi salvo automaticamente.</p>
            <button className="btn primary" onClick={() => { this.setState({ error: null }); useEditor.getState().close(); }}>Voltar ao início</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const hasProject = useEditor((s) => !!s.project);
  useEffect(() => {
    const onErr = (e: PromiseRejectionEvent) => {
      const msg = (e.reason as Error)?.message ?? String(e.reason);
      if (/abort|cancel/i.test(msg)) return;
      console.warn('unhandled', e.reason);
    };
    window.addEventListener('unhandledrejection', onErr);
    return () => window.removeEventListener('unhandledrejection', onErr);
  }, []);
  return <ErrorBoundary>{hasProject ? <Editor /> : <Home />}</ErrorBoundary>;
}
