# ADR 0001: el tablero consume una fuente mediante `TwinGateway`

- Estado: Aceptada
- Fecha: 2026-10-21

## Contexto

El tablero puede leer el gemelo Java en tiempo real o ejecutar una demostración local. Las vistas no deben
conocer REST, STOMP ni el motor físico; mezclar esos detalles con React haría que cambiar de fuente obligara
a reescribir la presentación y las reglas de dominio.

## Decisión

La UI depende del puerto `TwinGateway`. `BackendTwinGateway` implementa REST y STOMP; `InMemoryPhysicsGateway`
implementa la simulación. `createGateway` selecciona la implementación según configuración y autenticación.
En producción, la selección por defecto es el backend y un fallo de conexión se muestra explícitamente.

## Consecuencias

- Las vistas se prueban con snapshots del puerto y no necesitan conexiones de red.
- El dominio TypeScript conserva reglas puras compartidas con el backend Java.
- La simulación se puede elegir durante desarrollo sin presentar sus datos como lecturas reales.
- Una fuente nueva debe implementar el puerto y declarar sus capacidades antes de conectarse a la UI.

## Verificación

La fábrica de gateways y los adaptadores cuentan con pruebas Vitest; `npm run typecheck` comprueba el contrato
estático del puerto.
