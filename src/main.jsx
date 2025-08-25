import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfirmProvider } from './components/ConfirmProvider.jsx';
import './index.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </React.StrictMode>
);
