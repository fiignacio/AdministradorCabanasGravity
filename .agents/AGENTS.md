# Reglas y Guardarraíles del Proyecto Cabañas Manuara

## 1. Identidad de Marca y Nombre Comercial
- El nombre comercial oficial de este proyecto es **Cabañas Manuara** (`cabanasmanuara@gmail.com`, `+56 9 8456 2244`). Nunca utilizar "Gravity" en interfaces de usuario, PDFs o documentos generados.

## 2. Gestión de Reservas Históricas (Fechas Pasadas)
- Los administradores en rutas `/admin/*` tienen la facultad de crear reservas históricas con fechas de inicio/fin pasadas. Siempre se debe desplegar el distintivo `📜 Modo Administrador: Registrando reserva histórica`.
- El portal público (`/disponibilidad`) **nunca** debe permitir seleccionar fechas pasadas (`min={today}`).

## 3. Flujo de Solicitudes Públicas y Aprobación Manual
- Las reservas originadas desde el portal público de clientes deben guardarse con `status: 'pending'`.
- **Queda strictly prohibida la aprobación o confirmación automática.** Toda pre-reserva debe ser revisada y confirmada manualmente por el administrador en su panel.

## 4. Estilo Visual para Reservas de Referidos / Agencias
- Toda reserva que posea un `referrerId` (asociada a una agencia de viajes o referente) debe ser identificada visualmente con:
  - Gradiente Púrpura/Índigo: `linear-gradient(135deg, #8B5CF6, #6366F1)`.
  - Icono distintivo: `🤝` en las barras de calendario y badges de la tabla de reservas.
