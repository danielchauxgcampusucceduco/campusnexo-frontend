# Product

## Platform

web

## Users

Usuario principal: el jurado de la sustentación del proyecto del curso Patrones de Software. Lo ven en vivo mientras Daniel presenta, y después lo revisan por su cuenta. Tienen que poder comprobar que la arquitectura hexagonal y los patrones funcionan de verdad, no solo que la interfaz se ve bien.

Los usuarios que el producto simula, que son el personal de infraestructura y de biblioteca del campus y los estudiantes con la app móvil, son parte del relato de la demo y no un público confirmado.

## Product Purpose

CampusNexo es el gemelo digital de la Universidad Cooperativa de Colombia, campus Pasto: bloques A y B, pisos 0 a 5 y los 107 espacios del plano institucional 2025-B. Junta la ocupación detectada por cámaras con IA en el borde (YOLO + ByteTrack), el CO₂ y el Wi-Fi en un filtro de Kalman, y lee el Arduino de cada salón (temperatura y humedad con DHT22, luz, luces y equipos encendidos). Con eso controla el clima por MPC térmico, apaga luces y equipos de salones vacíos, libera aulas por no-show y evita que se acaparen mesas en la biblioteca.

El dashboard tiene éxito si, durante la sustentación, cada escenario se puede disparar y deja ver la causa (la medición), la decisión (el dominio) y el efecto (el actuador y el ahorro).

## Positioning

La interfaz no solo muestra los resultados: muestra el recorrido de cada evento por las capas hexagonales. Para eso usa trazas reales del backend: adaptador de entrada, puerto, caso de uso, dominio, puertos de salida y adaptadores de salida.

El dominio en TypeScript replica la matemática del backend Java (ray casting, Kalman, MPC RC) y se verifica con los mismos casos de prueba.

## Operating Context

- Sustentación en vivo con proyector: luz ambiente y lectura a distancia, con Daniel narrando.
- Revisión en el portátil del jurado o del profesor: se lee de cerca y con calma.
- La columna de escenarios dispara 13 escenarios de sustentación. En la simulación también se puede acelerar el tiempo, por ejemplo a 60×.
- Fuente de datos: el backend Spring Boot (REST + STOMP). Si no responde, se usa una simulación física en el navegador, para que la demo funcione sin red. La fuente se puede cambiar en vivo desde la barra superior.

## Capabilities and Constraints

- Vistas:
  - `#/campus`: planos reales por piso, cada salón pintado por su estado general (libre, ocupado, sobrecupo, luces o equipos encendidos sin nadie, mantenimiento).
  - `#/salon`: cámara con IA de un salón, mapa de pupitres, Arduino y conteo de personas en lenguaje sencillo (ecuaciones de Kalman a un clic).
  - `#/biblioteca`: anti-acaparamiento de 8 mesas, más la maqueta de la app estudiantil con check-in QR y aulas pop-up.
  - `#/funciona`: mira → mide → decide → actúa con valores en vivo; la traza hexagonal a un clic.
  - `#/energia`: kWh, COP y kg CO₂.
- Lenguaje: sin términos de desarrollo de software en la superficie; el detalle técnico siempre queda a un clic.
- Stack existente: React 19, TypeScript, Vite, Tailwind 4, Recharts, Lucide, STOMP. La UI solo depende del puerto `TwinGateway`.
- Idioma de la interfaz: español (Colombia). Hora de referencia: Bogotá.
- La escena de cámara es una representación: el edge no envía imágenes al dashboard.
- Los umbrales, tarifas y el factor de emisión son ilustrativos.

## Brand Commitments

Solo el nombre CampusNexo. No hay logo, colores ni plantilla institucional obligatorios.

## Evidence on Hand

- Backend propio con tests de dominio, ArchUnit e integración: repositorio `campusnexo-backend`, CI en verde.
- 18 tests de vitest en el frontend, sobre el dominio y la simulación.
- Documentación en `backend/docs/`: gemelo digital, patrones de software, API y despliegue.
- Los espacios, códigos, pisos y áreas salen del plano real del campus; pupitres, aforo y computadores por salón son estimados. No hay mediciones reales de sensores, usuarios, testimonios ni ahorro medido. No se deben inventar.

## Product Principles

1. Toda cifra debe poder rastrearse hasta la regla del dominio que la produjo.
2. La causa, la decisión y el efecto se ven juntos. Un escenario sin efecto visible no está terminado.
3. La demo nunca se cae: la simulación local es un camino de primera clase, no un plan B oculto.
4. Debe leerse a distancia en un proyector y de cerca en un portátil.
5. Honestidad del prototipo: lo simulado o ilustrativo se presenta como tal.
