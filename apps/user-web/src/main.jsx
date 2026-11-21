import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, initTheme } from '@dusknyt/ui';
import '@dusknyt/ui/styles.css';
import App from './App.jsx';

initTheme();
const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1, refetchOnWindowFocus: true, refetchOnReconnect: true, refetchOnMount: true, refetchInterval: 15_000, refetchIntervalInBackground: false } } });

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={qc}>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>,
);
