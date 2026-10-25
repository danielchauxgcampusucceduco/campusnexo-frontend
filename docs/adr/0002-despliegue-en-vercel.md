# ADR 0002: sitio estático en Vercel que llama directo al backend en Render

- Estado: Aceptada
- Fecha: 2026-10-24

## Contexto

El tablero es una aplicación de una sola página sin servidor propio. Necesita REST y WebSocket (STOMP) contra el backend, y el backend necesita la IP real de cada administrador para aplicar la regla de la VPN (`ADMIN_ALLOWED_NETWORKS`).

## Decisión

- Vercel sirve el bundle de Vite (`vercel.json`) con cabeceras de seguridad y caché inmutable para `/assets`.
- El navegador llama directamente a Render (`VITE_API_URL`, `VITE_WS_URL`); no hay proxy en Vercel.
- La imagen Docker con nginx se elimina: en local basta `npm run dev` con el proxy de Vite.

## Consecuencias

- El backend debe permitir el origen de Vercel en CORS (`CORS_ALLOWED_ORIGINS`, admite patrones para las vistas previas).
- Vercel no ve tokens ni datos: solo entrega archivos estáticos.
- Cambiar la URL del backend requiere un nuevo despliegue, porque las variables `VITE_*` se fijan al compilar.

## Alternativas consideradas

- Rewrites de Vercel hacia Render: no reenvían WebSocket y ocultarían la IP del administrador detrás del proxy de Vercel.
- Servir el tablero desde Render con nginx: un servicio más que mantener despierto en el plan gratuito.
