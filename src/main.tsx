/**
 * B002 - src/main.tsx
 * ===================
 * React application entry point.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D018 (ThemeProvider)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

// SAFETY: Import Mock Layer ONLY if strict Tauri (window.__TAURI__) is missing.
// This prevents the mock from ever polluting the production app running inside Tauri.
if (typeof window !== 'undefined' && !window.__TAURI__) {
  console.log('[App Factory] Browser environment detected. Loading Mock Layer...');
  import('./mocks/tauri-v1.8-mock');
}

// Get root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found. Make sure index.html has a div with id="root".');
}

// Create React root and render app
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
