import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App render failed:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-shell app-error-shell">
          <section className="error-panel">
            <h1>Research Proposal Agent could not render</h1>
            <p>
              The app loaded, but React hit a runtime error. Open the browser console for the full stack trace, then run
              <code> npm.cmd run check:app </code> before restarting the dev server.
            </p>
            <pre>{this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}</pre>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root element in index.html.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
