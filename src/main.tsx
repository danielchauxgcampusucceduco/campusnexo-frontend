import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TwinProvider } from './application/TwinContext';
import './styles.css';
import { App } from './ui/App';
import { LoginScreen, UnavailableScreen } from './ui/components/AccessScreens';
import { BootScreen } from './ui/components/BootScreen';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TwinProvider screens={{
      loading: <BootScreen />,
      login: (props) => <LoginScreen {...props} />,
      unavailable: (props) => <UnavailableScreen {...props} />,
    }}>
      <App />
    </TwinProvider>
  </StrictMode>,
);
