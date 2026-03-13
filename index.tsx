import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { injectSpeedInsights } from '@vercel/speed-insights';
import App from './App';

// Initialize Vercel Speed Insights before rendering
injectSpeedInsights({
  // Auto-detects project ID from Vercel environment,
  // or use VITE_VERCEL_SPEED_INSIGHTS_ID env var for other platforms
  dsn: import.meta.env.VITE_VERCEL_SPEED_INSIGHTS_ID,
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);