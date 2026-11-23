# Cabañas Manuara — Arquitectura Monorepo Separada

Este repositorio separa la **Página Web Pública** y el **Panel Administrador** en dos proyectos independientes que se comunican en tiempo real a través del mismo proyecto de **Supabase**.

## Estructura del Proyecto

```text
├── apps/
│   ├── web/              # Sitio Web Público de Cabañas Manuara (puerto 5173)
│   └── admin/            # Panel Administrador PWA (puerto 5174)
├── packages/
│   └── shared/           # Utilidades compartidas (@cabanas/shared): Supabase, precios, fechas, WhatsApp
└── supabase/
    ├── schema.sql        # Esquema unificado, app_settings, availability_slots, RPC y RLS
    └── qa_entities_seed.sql
```

## Cómo se Comunican Ambos Proyectos

1. **Catálogos y Configuración (`Admin → Web`)**:
   - Cabañas (`cabins`), Vehículos (`cars`), Tours (`tours`) y la configuración global (`app_settings`: marca, teléfono, email, logo, tarifas, temporadas alta/baja y descuentos) se guardan en Supabase y se sincronizan vía **Realtime** hacia `apps/web`.
2. **Disponibilidad Segura sin Datos Personales (`Admin → Web`)**:
   - Triggers en PostgreSQL replican automáticamente solo los rangos de fechas ocupadas hacia `availability_slots` (sin nombres, teléfonos, pagos ni notas). `apps/web` consulta y escucha cambios en tiempo real solo desde esa tabla.
3. **Solicitudes de Pre-Reserva y Notificaciones (`Web → Admin`)**:
   - Cuando un visitante envía una solicitud en `apps/web`, se invoca la función RPC `create_public_booking_request`, que valida disponibilidad, impide fechas pasadas, inserta la reserva siempre en estado `pending` (aprobación manual obligatoria) y registra una alerta en `admin_notifications`.
   - `apps/admin` recibe la pre-reserva y la notificación en tiempo real (con alerta sonora/nativa) para confirmarla o rechazarla manualmente.

## Configuración Inicial

### 1. Base de Datos y Usuario Administrador en Supabase
1. Abre **Supabase → SQL Editor** y ejecuta completo [supabase/schema.sql](supabase/schema.sql).
2. Abre **Supabase → Authentication → Users** y crea el usuario administrador (correo y contraseña) con el que iniciarás sesión en `apps/admin`.

### 2. Variables de Entorno Locales
Crea los archivos `.env` a partir de sus ejemplos:

- **`apps/web/.env`** (copia de `apps/web/.env.example`):
  ```env
  VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
  VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
  ```
- **`apps/admin/.env`** (copia de `apps/admin/.env.example`):
  ```env
  VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
  VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
  VITE_PUBLIC_SITE_URL=http://localhost:5173
  ```

### 3. Ejecución Local
```bash
npm install

# Terminal 1: Sitio Web Público (http://localhost:5173)
npm run dev:web

# Terminal 2: Panel Administrador (http://localhost:5174)
npm run dev:admin
```

## Despliegue Separado (Vercel / Netlify)

Conecta este repositorio como **dos proyectos independientes**:

| Proyecto | Root Directory | Build Command | Output Directory | Variables de Entorno |
|---|---|---|---|---|
| **Sitio Web Público** | `apps/web` | `npm run build` | `dist` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **Panel Administrador** | `apps/admin` | `npm run build` | `dist` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL` *(URL del sitio web desplegado)* |
