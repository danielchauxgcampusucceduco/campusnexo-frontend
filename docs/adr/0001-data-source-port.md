# ADR 0001: el tablero habla con el backend mediante dos puertos

- Estado: Aceptada
- Fecha: 2026-10-24 (reemplaza la versión del 2026-10-21, que incluía una simulación en el navegador)

## Contexto

Las vistas no deben conocer REST, STOMP ni los detalles de autenticación. El tablero es operativo: debe mostrar el campus real (o la piloto emulada, marcada como tal) y nunca datos inventados. Las reglas del dominio ya viven en el backend Java; repetirlas en TypeScript obligaba a mantener dos implementaciones iguales.

## Decisión

- `TwinGateway` entrega el gemelo en vivo: carga inicial por REST y actualizaciones por STOMP (`/topic/twin`, `/topic/traces`).
- `OperacionesPort` reúne los comandos (mantenimiento, sala de estudio, control del docente, reservas), las alertas y la administración (personas, puestos, herramientas de IA).
- Ambos adaptadores comparten un cliente REST que conserva el `code` del ProblemDetail del backend; un 401 en cualquiera de los dos cierra la sesión.
- Se elimina la simulación en el navegador y el dominio duplicado (Kalman, MPC, estados, anti-acaparamiento). El tablero solo presenta lo que el backend calcula.

## Consecuencias

- Sin backend no hay tablero: se muestra «Sin conexión con el servidor» con «Reintentar».
- Las vistas se prueban con fixtures del contrato (`src/test/fixtures.ts`), sin red.
- Un cambio en una regla de negocio se hace una sola vez, en Java.
- Cualquier fuente de datos de prueba pasa por la misma API de ingesta que el hardware real.
