
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DialogProvider } from './contexts/DialogContext';
import { SetupScreen } from './components/SetupScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getConfiguredApiUrl } from './src/gas-api';
import './src/styles/astryx-theme.css';

function Root() {
  const [configured, setConfigured] = useState<boolean>(() => {
    return Boolean(getConfiguredApiUrl());
  });

  if (!configured) {
    return <SetupScreen onComplete={() => setConfigured(true)} />;
  }

  return (
    <div data-astryx-theme="neutral">
      <DialogProvider>
        <App />
      </DialogProvider>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>
);
