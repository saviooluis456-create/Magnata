import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useEditor } from '../store/editor';
import Editor from './Editor';
import Home from './Home';

const Central = lazy(() => import('../central/ui/Central'));
const isCentral = () => location.hash.startsWith('#central');

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
  const [central, setCentral] = useState(isCentral);
  useEffect(() => {
    const onHash = () => setCentral(isCentral());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    const onErr = (e: PromiseRejectionEvent) => {
      const msg = (e.reason as Error)?.message ?? String(e.reason);
      if (/abort|cancel/i.test(msg)) return;
      console.warn('unhandled', e.reason);
    };
    window.addEventListener('unhandledrejection', onErr);
    return () => window.removeEventListener('unhandledrejection', onErr);
  }, []);
  if (central) return <ErrorBoundary><Suspense fallback={<div className="home"><div className="spinner" /></div>}><Central /></Suspense></ErrorBoundary>;
  return <ErrorBoundary>{hasProject ? <Editor /> : <Home />}</ErrorBoundary>;
}
