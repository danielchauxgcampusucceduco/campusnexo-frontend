import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginScreen, UnavailableScreen } from './AccessScreens';

describe('access screens', () => {
  it('renders a semantic login form with browser credential hints', () => {
    const markup = renderToStaticMarkup(<LoginScreen reason="Sesión protegida" submit={vi.fn()} />);

    expect(markup).toContain('<h1');
    expect(markup).toContain('Iniciar sesión');
    expect(markup.toLowerCase()).toContain('autocomplete="username"');
    expect(markup.toLowerCase()).toContain('autocomplete="current-password"');
    expect(markup).toContain('required=""');
    // The VPN is mentioned only where an action needs it (U3), not on the sign-in screen.
    expect(markup).not.toContain('VPN');
    expect(markup).toContain('Mostrar la contraseña');
  });

  it('makes the outage explicit, offers a retry and never invents data', () => {
    const markup = renderToStaticMarkup(<UnavailableScreen reason="HTTP 503" retry={vi.fn()} />);

    expect(markup).toContain('Sin conexión con el servidor');
    expect(markup).toContain('HTTP 503');
    expect(markup).toContain('Reintentar');
    expect(markup).toContain('no muestra datos inventados');
    expect(markup).not.toContain('simulación');
  });
});
