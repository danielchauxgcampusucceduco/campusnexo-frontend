import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginScreen, UnavailableScreen } from './AccessScreens';

describe('access screens', () => {
  it('renders a semantic login form with browser credential hints and simulation disclosure', () => {
    const markup = renderToStaticMarkup(
      <LoginScreen reason="Sesión protegida" submit={vi.fn()} chooseSimulation={vi.fn()} />,
    );

    expect(markup).toContain('<h1');
    expect(markup).toContain('Iniciar sesión');
    expect(markup.toLowerCase()).toContain('autocomplete="username"');
    expect(markup.toLowerCase()).toContain('autocomplete="current-password"');
    expect(markup).toContain('required=""');
    expect(markup).toContain('datos generados, no del campus');
  });

  it('makes the outage explicit and offers retry and an accurately labelled simulation', () => {
    const markup = renderToStaticMarkup(
      <UnavailableScreen reason="HTTP 503" retry={vi.fn()} chooseSimulation={vi.fn()} />,
    );

    expect(markup).toContain('Sin conexión con el servidor');
    expect(markup).toContain('HTTP 503');
    expect(markup).toContain('Reintentar');
    expect(markup).toContain('datos generados, no del campus');
  });
});
