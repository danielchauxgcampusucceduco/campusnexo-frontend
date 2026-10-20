# CampusNexo Dashboard

Panel del gemelo digital de CampusNexo: visión edge en vivo, gemelo 2.5D de las tres sedes, monitor anti-acaparamiento de la biblioteca con la app estudiantil, trazabilidad de la arquitectura hexagonal y ahorro energético. Está hecho con React 19, TypeScript, Tailwind CSS 4, Recharts y Lucide.

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
| `#/gemelo` | Mapa isométrico de las tres sedes: altura sólida = ocupación, marco = aforo, color = estado y estrategia HVAC. El detalle incluye la trayectoria térmica prevista contra la banda de confort. |
| `#/camara` | Vista cenital a la frecuencia del monitor: ROI por mesa con su estado y cuenta regresiva, cajas YOLO/ByteTrack, pixelado de privacidad, fallo de cámara y las ecuaciones de Kalman con los valores del último frame. |
| `#/biblioteca` | Monitor de las 8 mesas con cronómetro de 15 min y maqueta de la app estudiantil: mesas libres, check-in con código QR y aulas pop-up para parciales. |
| `#/arquitectura` | Hexágono por capas que se ilumina paso a paso con la traza real de cada evento: adaptador de entrada, puerto, caso de uso, dominio, puertos de salida y adaptadores de salida. |
| `#/energia` | Potencia actual frente al horario convencional; kWh, COP y kg CO₂ acumulados por espacio. |

La barra inferior dispara los 12 escenarios de sustentación. En la simulación también se puede acelerar el tiempo (por ejemplo, a 60×, los 15 minutos del cronómetro pasan en 15 segundos).

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

- La escena de la cámara es una representación: el edge no envía imágenes al dashboard. Con el backend, la escena se reconstruye a partir del gemelo (mesas y ocupación).
- El check-in de la app y el control directo de la cámara solo están en la simulación, porque con el backend requieren credenciales de estudiante o de dispositivo.
- Los parámetros (umbrales, tarifas, factor de emisión) son ilustrativos, igual que en el backend.
