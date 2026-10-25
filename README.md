# CampusNexo · Frontend

Tablero operativo del gemelo digital de la Universidad Cooperativa de Colombia, campus Pasto, para la administración de la universidad. Muestra en tiempo real el estado de cada salón (ocupación, luces, equipos, clima), quién está frente al tablero y quién en los puestos, los escenarios que el backend reconoce, las alertas y, para los administradores, el inventario de puestos (CPU, silla y mesa), los docentes y estudiantes, y las herramientas de IA.

Hecho con React 19, TypeScript, Tailwind CSS 4, Recharts, Lucide y STOMP. Se despliega como sitio estático en Vercel y solo habla con el backend Java (capa 2 de la arquitectura de 4 capas).

## Arquitectura

```text
src/
├── domain/                  tipos idénticos a los contratos del backend; sin reglas de negocio
│   ├── model.ts             gemelo, escenarios, presencia, reservas, alertas, personas, puestos, IA
│   └── kpis.ts              potencia del clima frente al horario convencional (solo presentación)
├── ports/
│   ├── TwinGateway.ts       el gemelo en vivo (REST inicial + STOMP)
│   └── OperacionesPort.ts   comandos y administración
├── adapters/backend/
│   ├── http.ts              cliente REST compartido: token, tiempo límite, ProblemDetail con `code`
│   ├── BackendSession.ts    inicio de sesión
│   ├── BackendTwinGateway.ts
│   └── BackendOperaciones.ts
├── application/             conexión, sesión y avisos (TwinContext, useRequest)
├── campus/                  plano 2025-B (campusPlan.json, generado con tools/plan del backend)
└── ui/                      vistas y componentes
```

- **Ninguna regla de negocio vive aquí.** La fusión de Kalman, los estados del salón, el clima, la presencia por zona y el reconocimiento de escenarios corren en el backend; el tablero los muestra tal como llegan.
- **Falla cerrado.** Si el backend no responde, el tablero lo dice y ofrece reintentar; nunca muestra datos inventados. Un servidor de Render en reposo tarda cerca de un minuto en despertar.
- **Honestidad de la piloto.** Los salones cuyos datos no vienen de una cámara real (`emulated`) llevan la insignia «Emulado» y una franja fija lo advierte.
- **Sesión.** El token firmado por el backend se guarda en `sessionStorage`, viaja en `Authorization: Bearer` y en el `CONNECT` de STOMP. Lo que la interfaz ofrece sigue el rol: VIEWER consulta, OPERATOR además opera salones, reservas y alertas, ADMIN además administra.
- **VPN.** Las rutas `/admin/**` solo responden desde la red de la administración. Si el backend contesta `403 admin_network_required`, el tablero pide conectarse a la VPN.
- **Latencia.** La barra superior muestra el p95 desde el frame de la cámara hasta esta pantalla (atributo QA-2, meta ≤ 2 s). Compara el reloj del borde con el del navegador.

El adaptador valida cada evento del gemelo (enumerados, números finitos, presencia y escenarios), descarta los atrasados por `updatedAt` y marca la conexión degradada ante contratos inválidos.

## Vistas

| Ruta | Rol | Qué muestra |
|---|---|---|
| `#/campus` | todos | Planos reales por piso, salones piloto 301-A y 303-A, indicadores del campus y detalle del salón |
| `#/salon` | todos | Planta del salón con la zona del docente y los puestos, escenarios reconocidos, Arduino, fusión de Kalman; operación y pronóstico según el rol |
| `#/biblioteca` | todos | Mesas de la sala de lectura con el cronómetro anti-acaparamiento |
| `#/alertas` | OPERATOR, ADMIN | Alertas recientes, filtrables por tipo |
| `#/admin` | ADMIN | Puestos (propuesta de la cámara, emparejamiento de CPU, confirmación), medidas de los salones, docentes y estudiantes, salud de sensores y asignación de salones |
| `#/energia` | todos | Potencia actual frente al horario convencional y ahorro acumulado |
| `#/funciona` | todos | Mira, mide, decide, actúa, y el recorrido de cada evento por la arquitectura hexagonal |

La columna izquierda lista los escenarios reconocidos ahora, con los salones donde ocurren. Cada vista tiene su tecla (`C` `S` `L` `A` `D` `E` `F`).

## Desarrollo

```sh
npm ci
npm run dev          # http://localhost:5173; /api y /ws se envían a localhost:8080
npm test             # Vitest
npm run build        # tsc + bundle en dist/
```

Para ver datos, levanta el backend con `docker compose --profile sistema up` en `campusnexo-backend`.

## Despliegue en Vercel

1. Importa el repositorio en Vercel; `vercel.json` ya fija Vite, `npm ci`, `npm run build` y `dist/`.
2. Variables de entorno del proyecto (ver `.env.example`):
   - `VITE_API_URL=https://<backend>.onrender.com/api/v1`
   - `VITE_WS_URL=wss://<backend>.onrender.com/ws`
3. En el backend, agrega el dominio de Vercel a `CORS_ALLOWED_ORIGINS` (admite patrones como `https://campusnexo-*.vercel.app`).

El navegador llama directo a Render: Vercel no reenvía WebSocket, y así el backend ve la IP real del administrador para la regla de la VPN.

## Límites

- Los salones, pisos y áreas salen del plano `PLANOS_UCC_2025_-_B.dwg`; 301-A y 303-A no están en ese plano y se listan aparte como salones piloto.
- La planta del salón es una representación de las posiciones que envía el borde; ninguna imagen sale del salón.
- La latencia mostrada depende de que los relojes del borde y del navegador estén sincronizados.
