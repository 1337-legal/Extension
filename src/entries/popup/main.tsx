import '../enableDevHmr';
import './assets/App.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import Router from './Router';

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
