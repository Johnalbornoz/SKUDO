import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext.jsx';
import App from './App.jsx';
import './index.css';

// Guarda global: evita ReferenceError si algún código (caché o dependencia) llama a _dbg
if (typeof window !== 'undefined') {
  window._dbg = window._dbg || (() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
