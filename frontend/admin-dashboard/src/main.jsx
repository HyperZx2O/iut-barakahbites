import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import App from './App';
import './styles/theme.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AdminAuthProvider>
      <App />
    </AdminAuthProvider>
  </BrowserRouter>
);
