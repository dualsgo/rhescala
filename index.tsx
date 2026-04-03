
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DialogProvider } from './contexts/DialogContext';

const init = () => {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
        console.error("Critical: Could not find root element #root");
        return;
    }

    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <DialogProvider>
                <App />
            </DialogProvider>
        </React.StrictMode>
    );
};

// Carregamento resiliente para garantir que o DOM esteja pronto, 
// especialmente importante quando o bundle é inlined no <head> via vite-plugin-singlefile
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
