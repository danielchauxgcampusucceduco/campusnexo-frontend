# CampusNexo Dashboard

Panel del gemelo digital de CampusNexo para la Universidad Cooperativa de Colombia, campus Pasto: los planos reales del campus (actualización 2025-B) con cada salón pintado según su ocupación, luces, equipos y temperatura; la cámara con IA de cada salón; el monitor anti-acaparamiento de la biblioteca con la app estudiantil; una explicación sencilla de cómo funciona (con la arquitectura hexagonal a un clic) y el ahorro energético. Está hecho con React 19, TypeScript, Tailwind CSS 4, Recharts y Lucide.

## Arquitectura hexagonal también en el frontend

```text
src/
├── domain/                 modelo y reglas puras, sin React ni red
│   ├── model.ts            tipos idénticos a los contratos del backend Java
│   ├── geometry.ts         ray casting (StudyZoneRoi.containsPoint)
│   ├── kalman.ts           OccupancyKalmanDomainService
│   ├── thermal.ts          ThermalInertiaMpcDomainService
│   ├── status.ts desks.ts  SpaceStatusPolicy y anti-acaparamiento
│   └── kpis.ts             kWh, COP y kg CO₂
├── ports/TwinGateway.ts    puerto que necesita la UI
├── adapters/
│   ├── backend/            REST + STOMP contra el backend Java
│   └── simulation/         simulación física en el navegador (respaldo)
├── application/            elección del adaptador y estado compartido (TwinContext)
└── ui/                     vistas y componentes de presentación
```

La UI solo conoce el puerto `TwinGateway`. Al iniciar, `createGateway` prueba el backend (`GET /api/v1/twin/spaces`). Si responde, usa `BackendTwinGateway`: REST para consultas y escenarios, y STOMP sobre WebSocket (`/topic/twin`, `/topic/traces`) para actualizaciones. Si no responde, usa `InMemoryPhysicsGateway`, un motor físico (personas, CO₂ y temperatura con el mismo modelo RC del MPC) que alimenta frames YOLO sintéticos a una versión TypeScript de `ProcessSpaceTelemetryService`. Así la sustentación funciona aunque no haya red. La barra superior permite cambiar de fuente en vivo.

El dominio TypeScript replica la matemática del backend, y `src/domain/domain.test.ts` usa los mismos casos que los tests de Java para que ambas implementaciones coincidan.

## Vistas

| Ruta | Qué muestra |
|---|---|
| `#/campus` | Planos reales del campus, piso por piso (bloques A y B). Cada salón se colorea por su estado: libre, ocupado, sobrecupo, luces encendidas sin nadie, equipos encendidos sin uso o mantenimiento; muestra el porcentaje de ocupación, los pupitres ocupados, el brillo de las luces y los computadores encendidos. La torre de pisos resume cada piso y el panel lateral da el detalle del salón con su Arduino. |
| `#/salon` | La cámara con IA de un salón: personas, portátiles, morrales y libros, y el pupitre de cada uno; mapa de pupitres, lecturas del Arduino (DHT22, fotorresistencia, sensor de corriente, CO₂) y cómo se juntan cámara, CO₂ y Wi-Fi para contar personas (las ecuaciones de Kalman quedan a un clic). |
| `#/biblioteca` | Monitor de las 8 mesas con cronómetro de 15 min y maqueta de la app estudiantil: mesas libres, check-in con código QR y aulas pop-up para parciales. |
| `#/funciona` | Los cuatro pasos (mira, mide, decide, actúa) con los valores en vivo del salón seleccionado. El botón «Ver el recorrido técnico» abre el hexágono por capas que se ilumina con la traza real de cada evento. |
| `#/energia` | Potencia actual frente al horario convencional; kWh, COP y kg CO₂ acumulados por espacio. |

La columna izquierda dispara los 13 escenarios de sustentación, agrupados por lo que demuestran. Después de cada uno, una franja grande arriba de la vista resume la causa (lo medido), la decisión (la regla del dominio que la tomó) y el efecto (lo que se le ordenó al clima o al Arduino), y se actualiza en vivo mientras el espacio se asienta. En la simulación también se puede acelerar el tiempo (por ejemplo, a 60×, los 15 minutos del cronómetro pasan en 15 segundos).

### Modo presentación y atajos

Con el modo presentación activo (tecla `P`, activo por defecto), cada escenario lleva la pantalla a la vista donde se ve su efecto, selecciona el espacio afectado, lo hace pulsar en el mapa y oculta los párrafos de introducción para dejar más espacio en el proyector.

| Tecla | Acción |
|---|---|
| `1`–`9`, `0`, `M`, `B` | Escenarios, en el orden de la columna |
| `R` | Reiniciar todo |
| `C` `S` `L` `F` `E` | Campus, Salón, Biblioteca, Cómo funciona, Energía |
| `P` | Activar o desactivar el modo presentación |
| `Espacio`, `←` `→` | En el recorrido técnico: pausar el recorrido y avanzarlo paso a paso |

## Desarrollo

```sh
npm install
npm run dev          # http://localhost:5173; /api y /ws se envían a localhost:8080
npm test             # tests del dominio y de la simulación
npm run build        # tsc + bundle de producción en dist/
```

Variables (ver `.env.example`):

- `VITE_API_URL`: base REST; por defecto `/api/v1`.
- `VITE_WS_URL`: endpoint STOMP; por defecto `ws(s)://<origen>/ws`.
- `VITE_DATA_SOURCE`: `auto`, `backend` o `simulation`.

## Docker

La imagen corre los tests, compila y sirve la app con nginx. nginx reenvía `/api` y `/ws` al servicio `backend:8080` de docker compose.

```sh
docker build -t campusnexo-dashboard .
```

En un hosting estático (por ejemplo, un Static Site de Render), compila con `VITE_API_URL=https://<backend>/api/v1` y `VITE_WS_URL=wss://<backend>/ws`, y agrega el origen del dashboard a `CORS_ALLOWED_ORIGINS` en el backend.

## Límites

- Los salones, sus códigos, pisos y áreas salen del plano `PLANOS_UCC_2025_-_B.dwg` (`src/campus/campusPlan.json`, generado con `tools/plan/` del backend). El número de pupitres y de computadores se estima a partir del tipo y del área: no está en el plano.
- La escena de la cámara es una representación: el edge no envía imágenes al dashboard. Con el backend, la escena se reconstruye a partir del gemelo (mesas y ocupación).
- El check-in de la app y el control directo de la cámara solo están en la simulación, porque con el backend requieren credenciales de estudiante o de dispositivo.
- Los parámetros (umbrales, tarifas, factor de emisión) son ilustrativos, igual que en el backend.
