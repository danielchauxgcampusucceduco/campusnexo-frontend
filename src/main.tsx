import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TwinProvider } from './application/TwinContext';
import './styles.css';
import { App } from './ui/App';
import { BootScreen } from './ui/components/BootScreen';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TwinProvider fallback={<BootScreen />}>
      <App />
    </TwinProvider>
  </StrictMode>,
);
