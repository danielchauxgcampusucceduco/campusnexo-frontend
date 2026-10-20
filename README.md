# CampusNexo Frontend

Dashboard responsive en React. Cambia de sede, selecciona espacios, actualiza lecturas desde la API y permite disparar escenarios de demostración explícitamente etiquetados. Si el backend no está disponible, mantiene datos de muestra locales.

## Inicio

```sh
npm install
npm run dev
```

Configura `VITE_API_URL` si el backend no está en `http://localhost:8080/api/v1`. `npm run build` crea el bundle de producción.

Las gráficas de tendencia y algunos indicadores son demostrativos; no se deben citar como resultados experimentales. El panel no manda comandos a equipos reales.
