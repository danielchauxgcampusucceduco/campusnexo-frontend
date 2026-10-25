# Product

## Platform

web

## Users

Personal de la administración del campus Pasto de la Universidad Cooperativa de Colombia: coordinación de planta física, soporte de salas de cómputo y biblioteca. Hay tres roles: consulta, operación (salones, reservas, alertas) y administración (inventario de puestos, personas, herramientas de IA). Docentes y estudiantes no usan el tablero: aparecen en él como titulares de reservas y como presencia que la cámara ubica por zona.

## Product Purpose

CampusNexo es el gemelo digital del campus: bloques A y B, pisos 0 a 5, los 107 espacios del plano 2025-B y los salones piloto 301-A (sala de cómputo) y 303-A (aula). Junta la cámara con IA en el borde, el CO₂ y el Wi-Fi en un filtro de Kalman, lee el Arduino de cada salón y reconoce escenarios operativos: clase en curso, CO₂ alto, cámara caída, sobrecupo, nadie llegó, poca asistencia, sala de estudio, luces o equipos encendidos sin nadie, control del docente, mantenimiento y acaparamiento.

El tablero tiene éxito si alguien de la administración puede, en segundos, saber qué salón necesita atención, por qué, y actuar.

## Operating Context

- Oficina de la administración, en un portátil o en una pantalla de control; también en el proyector durante la presentación al stakeholder.
- La administración entra por la VPN de la universidad; sin ella, las funciones de administración responden con un aviso.
- Fuente de datos: el backend Spring Boot (REST + STOMP). Los datos que no vienen de una cámara real se marcan como «Emulado».

## Brand

Colores de la Universidad Cooperativa de Colombia: azul marino #132740 en encabezados y superficies oscuras, cian #00ACC9 como color de señal, verde #80BA27 para lo libre o ahorrado, lima #CAD400 para lo que pide atención y gris #5F5E5E en el texto secundario. El cian no se usa como texto sobre blanco (contraste insuficiente); el rojo queda solo para sobrecupo y alertas críticas.
