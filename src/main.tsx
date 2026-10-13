import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './pages/App';
import { DebugModel } from './pages/DebugModel';
import { Gallery } from './pages/Gallery';
import { useEditor } from './core/store/store';

// Benign browser notice (layout settles over two frames when React Flow measures nodes); keep it
// out of error reporting.
window.addEventListener('error', (e) => {
  if (e.message?.includes('ResizeObserver loop')) e.stopImmediatePropagation();
});

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// Dev/test hook: E2E tests read and compare model state (never in production builds).
if (import.meta.env.DEV) (window as unknown as { __editor: typeof useEditor }).__editor = useEditor;

const page = new URLSearchParams(location.search).get('page');

const Page =
  page === 'debug'
    ? DebugModel
    : page === 'gallery' || location.pathname === '/gallery'
      ? Gallery
      : App;

createRoot(root).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
