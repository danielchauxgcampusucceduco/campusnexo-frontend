import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { TwinProvider } from './application/TwinContext';
import './styles.css';
import { LoginScreen, UnavailableScreen } from './ui/components/AccessScreens';
import { BootScreen } from './ui/components/BootScreen';

// The dashboard loads after sign-in (P1): the sign-in screen downloads only what it shows.
const App = lazy(() => import('./ui/App').then((module) => ({ default: module.App })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TwinProvider screens={{
      loading: <BootScreen />,
      login: (props) => <LoginScreen {...props} />,
      unavailable: (props) => <UnavailableScreen {...props} />,
    }}>
      <Suspense fallback={<BootScreen />}>
        <App />
      </Suspense>
    </TwinProvider>
  </StrictMode>,
);
