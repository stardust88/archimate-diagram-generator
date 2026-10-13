import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './pages/App';
import { DebugModel } from './pages/DebugModel';
import { Gallery } from './pages/Gallery';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

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
