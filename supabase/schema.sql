-- ============================================================================
-- ESQUEMA UNIFICADO Y SEGURO DE SUPABASE - CABAÑAS MANUARA
-- Arquitectura separada: apps/web (Portal Público) <-> Supabase <-> apps/admin
--
-- Instrucciones:
-- 1. Abre tu proyecto en https://supabase.com -> SQL Editor.
-- 2. Copia y ejecuta este script completo (es idempotente y no destructivo).
-- 3. En Supabase -> Authentication -> Users, crea el usuario administrador
--    (correo + contraseña) para iniciar sesión en apps/admin.
-- ============================================================================

-- ============================================================================
-- 1. TABLAS DE CATÁLOGO Y CONFIGURACIÓN GLOBAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cabins (
    id text PRIMARY KEY,
    name text NOT NULL,
    type text DEFAULT 'standard',
    "maxCapacity" integer DEFAULT 4,
    color text DEFAULT '#2980b9',
    owner text DEFAULT ''
);
ALTER TABLE public.cabins ADD COLUMN IF NOT EXISTS owner text DEFAULT '';

CREATE TABLE IF NOT EXISTS public.cars (
    id text PRIMARY KEY,
    name text NOT NULL,
    plate text NOT NULL,
    "dailyRate" numeric NOT NULL DEFAULT 0,
    color text DEFAULT '#27ae60',
    "isActive" boolean DEFAULT true,
    "promoThresholdDays" integer DEFAULT 0,
    "promoDailyRate" numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS "promoThresholdDays" integer DEFAULT 0;
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS "promoDailyRate" numeric DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.tours (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text,
    price numeric DEFAULT 0,
    duration text,
    "maxCapacity" integer DEFAULT 10,
    color text DEFAULT '#8e44ad',
    "isActive" boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.tours ADD COLUMN IF NOT EXISTS "maxCapacity" integer DEFAULT 10;
ALTER TABLE public.tours ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true;

-- Configuración global compartida en tiempo real entre Admin y Web Pública
CREATE TABLE IF NOT EXISTS public.app_settings (
    id text PRIMARY KEY DEFAULT 'default',
    business_config jsonb NOT NULL DEFAULT '{
        "businessName": "Cabañas Manuara",
        "administratorName": "Administrador Principal",
        "primaryColor": "#8C5A32",
        "contactPhone": "+56 9 8456 2244",
        "contactEmail": "cabanasmanuara@gmail.com",
        "logoUrl": "/images/logo_manuara.png",
        "isSetupCompleted": true
    }'::jsonb,
    prices jsonb NOT NULL DEFAULT '{
        "highSeasonAdult": 35000,
        "lowSeasonAdult": 30000,
        "child": 15000
    }'::jsonb,
    season_config jsonb NOT NULL DEFAULT '{
        "highSeasonMonths": [11, 0, 1, 2, 3],
        "highSeasonName": "Temporada Alta",
        "lowSeasonName": "Temporada Baja"
    }'::jsonb,
    discount_config jsonb NOT NULL DEFAULT '{
        "enableGroupDiscount": true,
        "groupMinGuests": 10,
        "groupRatePerAdult": 25000,
        "enableDurationDiscount": false,
        "durationMinNights": 7,
        "durationDiscountPercent": 10
    }'::jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.app_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. TABLAS PRIVADAS DE GESTIÓN (CON DATOS DE CLIENTES / OPERACIÓN)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.referrers (
    id text PRIMARY KEY,
    name text NOT NULL,
    phone text,
    email text,
    "createdAt" text
);

CREATE TABLE IF NOT EXISTS public.reservations (
    id text PRIMARY KEY,
    "cabinId" text NOT NULL,
    "clientName" text,
    "clientPhone" text,
    "startDate" text NOT NULL,
    "endDate" text NOT NULL,
    adults integer DEFAULT 1,
    "childrenCount" integer DEFAULT 0,
    "babiesCount" integer DEFAULT 0,
    "flightIn" text,
    "flightOut" text,
    "isBlock" boolean DEFAULT false,
    "totalCost" numeric DEFAULT 0,
    "depositAmount" numeric DEFAULT 0,
    "paymentMethod" text,
    status text DEFAULT 'confirmed',
    notes text,
    "referrerId" text,
    "referrerStatus" text DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "clientPhone" text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "depositAmount" numeric DEFAULT 0;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "paymentMethod" text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "referrerId" text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "referrerStatus" text DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS public.car_reservations (
    id text PRIMARY KEY,
    "carId" text NOT NULL,
    "clientName" text NOT NULL,
    "clientPhone" text,
    "startDate" text NOT NULL,
    "endDate" text NOT NULL,
    "totalCost" numeric DEFAULT 0,
    "depositAmount" numeric DEFAULT 0,
    "paymentMethod" text,
    status text DEFAULT 'confirmed',
    notes text,
    "linkedCabinReservationId" text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.car_reservations ADD COLUMN IF NOT EXISTS "clientPhone" text;
ALTER TABLE public.car_reservations ADD COLUMN IF NOT EXISTS "depositAmount" numeric DEFAULT 0;
ALTER TABLE public.car_reservations ADD COLUMN IF NOT EXISTS "paymentMethod" text;
ALTER TABLE public.car_reservations ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.car_reservations ADD COLUMN IF NOT EXISTS "linkedCabinReservationId" text;

CREATE TABLE IF NOT EXISTS public.tour_reservations (
    id text PRIMARY KEY,
    "tourId" text NOT NULL,
    "clientName" text NOT NULL,
    "clientPhone" text,
    date text NOT NULL,
    time text,
    "paxCount" integer DEFAULT 1,
    "totalCost" numeric DEFAULT 0,
    status text DEFAULT 'confirmed',
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Notificaciones internas Web -> Panel Administrador
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type text NOT NULL DEFAULT 'booking_request',
    title text NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    read boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 3. TABLA PÚBLICA DE DISPONIBILIDAD (SIN DATOS PERSONALES / PII)
-- Sincronizada automáticamente por triggers desde reservations y car_reservations
-- Permite que apps/web consulte y reciba cambios Realtime de disponibilidad
-- sin acceder jamás a nombres, teléfonos, pagos ni notas de otros huéspedes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.availability_slots (
    id text PRIMARY KEY,
    resource_type text NOT NULL CHECK (resource_type IN ('cabin', 'car')),
    resource_id text NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_availability_slots_lookup
    ON public.availability_slots (resource_type, resource_id, start_date, end_date);

-- Trigger: sincronizar reservas de cabañas -> availability_slots
CREATE OR REPLACE FUNCTION public.sync_cabin_availability_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.availability_slots WHERE id = 'cabin:' || OLD.id;
        RETURN OLD;
    END IF;

    IF NEW.status IN ('archived', 'cancelled', 'rejected') THEN
        DELETE FROM public.availability_slots WHERE id = 'cabin:' || NEW.id;
    ELSE
        INSERT INTO public.availability_slots (id, resource_type, resource_id, start_date, end_date, updated_at)
        VALUES ('cabin:' || NEW.id, 'cabin', NEW."cabinId", NEW."startDate", NEW."endDate", now())
        ON CONFLICT (id) DO UPDATE SET
            resource_id = EXCLUDED.resource_id,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            updated_at = now();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cabin_availability ON public.reservations;
CREATE TRIGGER trg_sync_cabin_availability
    AFTER INSERT OR UPDATE OR DELETE ON public.reservations
    FOR EACH ROW EXECUTE FUNCTION public.sync_cabin_availability_slot();

-- Trigger: sincronizar reservas de vehículos -> availability_slots
CREATE OR REPLACE FUNCTION public.sync_car_availability_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.availability_slots WHERE id = 'car:' || OLD.id;
        RETURN OLD;
    END IF;

    IF NEW.status IN ('archived', 'cancelled', 'rejected') THEN
        DELETE FROM public.availability_slots WHERE id = 'car:' || NEW.id;
    ELSE
        INSERT INTO public.availability_slots (id, resource_type, resource_id, start_date, end_date, updated_at)
        VALUES ('car:' || NEW.id, 'car', NEW."carId", NEW."startDate", NEW."endDate", now())
        ON CONFLICT (id) DO UPDATE SET
            resource_id = EXCLUDED.resource_id,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            updated_at = now();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_car_availability ON public.car_reservations;
CREATE TRIGGER trg_sync_car_availability
    AFTER INSERT OR UPDATE OR DELETE ON public.car_reservations
    FOR EACH ROW EXECUTE FUNCTION public.sync_car_availability_slot();

-- Backfill inicial para reservas ya existentes en la base de datos
INSERT INTO public.availability_slots (id, resource_type, resource_id, start_date, end_date, updated_at)
SELECT 'cabin:' || id, 'cabin', "cabinId", "startDate", "endDate", now()
FROM public.reservations
WHERE status IS NULL OR status NOT IN ('archived', 'cancelled', 'rejected')
ON CONFLICT (id) DO UPDATE SET
    resource_id = EXCLUDED.resource_id,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    updated_at = now();

INSERT INTO public.availability_slots (id, resource_type, resource_id, start_date, end_date, updated_at)
SELECT 'car:' || id, 'car', "carId", "startDate", "endDate", now()
FROM public.car_reservations
WHERE status IS NULL OR status NOT IN ('archived', 'cancelled', 'rejected')
ON CONFLICT (id) DO UPDATE SET
    resource_id = EXCLUDED.resource_id,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    updated_at = now();

-- ============================================================================
-- 4. RPC SEGURA PARA SOLICITUDES DE PRE-RESERVA DESDE LA WEB PÚBLICA
-- Reglas estrictas:
--   * Fuerza status = 'pending' (prohibida la auto-aprobación).
--   * Rechaza fechas de inicio pasadas desde el portal público.
--   * Registra atómicamente cabaña + vehículo (opcional) + notificación admin.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_public_booking_request(
    p_cabin_id text,
    p_client_name text,
    p_client_phone text,
    p_start_date text,
    p_end_date text,
    p_adults integer DEFAULT 1,
    p_children_count integer DEFAULT 0,
    p_babies_count integer DEFAULT 0,
    p_total_cost numeric DEFAULT 0,
    p_deposit_amount numeric DEFAULT 0,
    p_notes text DEFAULT '',
    p_car_id text DEFAULT NULL,
    p_car_start_date text DEFAULT NULL,
    p_car_end_date text DEFAULT NULL,
    p_car_total_cost numeric DEFAULT 0,
    p_car_deposit_amount numeric DEFAULT 0,
    p_notification_title text DEFAULT 'Nueva Solicitud de Reserva Web',
    p_notification_message text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cabin_res_id text := NULL;
    v_car_res_id text := NULL;
    v_notif_id text := NULL;
    v_has_conflict boolean := false;
BEGIN
    IF trim(COALESCE(p_client_name, '')) = '' OR trim(COALESCE(p_client_phone, '')) = '' THEN
        RAISE EXCEPTION 'Nombre y teléfono son obligatorios.';
    END IF;

    IF p_start_date::date < CURRENT_DATE THEN
        RAISE EXCEPTION 'No se permiten fechas pasadas desde el portal público.';
    END IF;

    IF p_end_date::date <= p_start_date::date THEN
        RAISE EXCEPTION 'La fecha de salida debe ser posterior a la llegada.';
    END IF;

    -- Validar conflicto de disponibilidad de cabaña
    IF p_cabin_id IS NOT NULL AND trim(p_cabin_id) <> '' THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.availability_slots
            WHERE resource_type = 'cabin'
              AND resource_id = p_cabin_id
              AND start_date < p_end_date
              AND end_date > p_start_date
        ) INTO v_has_conflict;

        IF v_has_conflict THEN
            RAISE EXCEPTION 'La cabaña seleccionada ya no está disponible en esas fechas.';
        END IF;

        v_cabin_res_id := 'web-' || extract(epoch from clock_timestamp())::bigint::text || '-' || substr(md5(random()::text), 1, 6);

        INSERT INTO public.reservations (
            id, "cabinId", "clientName", "clientPhone", "startDate", "endDate",
            adults, "childrenCount", "babiesCount", "isBlock",
            "totalCost", "depositAmount", "paymentMethod", status, notes
        ) VALUES (
            v_cabin_res_id, p_cabin_id, trim(p_client_name), trim(p_client_phone), p_start_date, p_end_date,
            GREATEST(1, COALESCE(p_adults, 1)),
            GREATEST(0, COALESCE(p_children_count, 0)),
            GREATEST(0, COALESCE(p_babies_count, 0)),
            false,
            GREATEST(0, COALESCE(p_total_cost, 0)),
            GREATEST(0, COALESCE(p_deposit_amount, 0)),
            'Por Confirmar',
            'pending',
            COALESCE(p_notes, '')
        );
    END IF;

    -- Validar e insertar reserva de vehículo opcional (también en estado pending)
    IF p_car_id IS NOT NULL AND trim(p_car_id) <> '' AND p_car_id <> 'none' THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.availability_slots
            WHERE resource_type = 'car'
              AND resource_id = p_car_id
              AND start_date < COALESCE(p_car_end_date, p_end_date)
              AND end_date > COALESCE(p_car_start_date, p_start_date)
        ) INTO v_has_conflict;

        IF v_has_conflict THEN
            RAISE EXCEPTION 'El vehículo seleccionado ya no está disponible en esas fechas.';
        END IF;

        v_car_res_id := 'webcar-' || extract(epoch from clock_timestamp())::bigint::text || '-' || substr(md5(random()::text), 1, 6);

        INSERT INTO public.car_reservations (
            id, "carId", "clientName", "clientPhone", "startDate", "endDate",
            "totalCost", "depositAmount", "paymentMethod", status,
            "linkedCabinReservationId", notes
        ) VALUES (
            v_car_res_id, p_car_id, trim(p_client_name), trim(p_client_phone),
            COALESCE(p_car_start_date, p_start_date),
            COALESCE(p_car_end_date, p_end_date),
            GREATEST(0, COALESCE(p_car_total_cost, 0)),
            GREATEST(0, COALESCE(p_car_deposit_amount, 0)),
            'Por Confirmar',
            'pending',
            v_cabin_res_id,
            COALESCE(p_notes, '')
        );
    END IF;

    -- Registrar notificación para el Panel Administrador
    v_notif_id := 'notif-' || extract(epoch from clock_timestamp())::bigint::text || '-' || substr(md5(random()::text), 1, 6);

    INSERT INTO public.admin_notifications (id, type, title, message, metadata, read)
    VALUES (
        v_notif_id,
        'booking_request',
        COALESCE(NULLIF(trim(p_notification_title), ''), 'Nueva Solicitud de Reserva Web'),
        COALESCE(NULLIF(trim(p_notification_message), ''), trim(p_client_name) || ' envió una solicitud pendiente.'),
        jsonb_build_object(
            'cabinReservationId', v_cabin_res_id,
            'carReservationId', v_car_res_id,
            'clientName', trim(p_client_name),
            'clientPhone', trim(p_client_phone),
            'startDate', p_start_date,
            'endDate', p_end_date,
            'totalCost', p_total_cost
        ),
        false
    );

    RETURN jsonb_build_object(
        'cabinReservationId', v_cabin_res_id,
        'carReservationId', v_car_res_id,
        'notificationId', v_notif_id,
        'status', 'pending'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_booking_request(
    text, text, text, text, text, integer, integer, integer, numeric, numeric, text, text, text, text, numeric, numeric, text, text
) TO anon, authenticated;

-- ============================================================================
-- 5. SEGURIDAD A NIVEL DE FILA (RLS)
-- ============================================================================

ALTER TABLE public.cabins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas heredadas abiertas
DROP POLICY IF EXISTS "Permitir todo acceso cabañas" ON public.cabins;
DROP POLICY IF EXISTS "Permitir todo acceso anónimo cabañas" ON public.cabins;
DROP POLICY IF EXISTS "Permitir todo acceso reservas" ON public.reservations;
DROP POLICY IF EXISTS "Permitir todo acceso anónimo reservas" ON public.reservations;
DROP POLICY IF EXISTS "Permitir todo acceso vehiculos" ON public.cars;
DROP POLICY IF EXISTS "Permitir todo acceso anónimo vehiculos" ON public.cars;
DROP POLICY IF EXISTS "Permitir todo acceso reservas vehiculos" ON public.car_reservations;
DROP POLICY IF EXISTS "Permitir todo acceso anónimo reservas_vehiculos" ON public.car_reservations;
DROP POLICY IF EXISTS "Permitir todo acceso tours" ON public.tours;
DROP POLICY IF EXISTS "Permitir todo acceso anónimo tours" ON public.tours;
DROP POLICY IF EXISTS "Permitir todo acceso reservas tours" ON public.tour_reservations;
DROP POLICY IF EXISTS "Permitir todo acceso anónimo reservas tours" ON public.tour_reservations;
DROP POLICY IF EXISTS "Permitir todo acceso anónimo referentes" ON public.referrers;

-- A) Tablas de lectura pública (Web + Admin) y escritura solo Admin autenticado
DROP POLICY IF EXISTS "public_read_cabins" ON public.cabins;
CREATE POLICY "public_read_cabins" ON public.cabins FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_cabins" ON public.cabins;
CREATE POLICY "admin_write_cabins" ON public.cabins FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_cars" ON public.cars;
CREATE POLICY "public_read_cars" ON public.cars FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_cars" ON public.cars;
CREATE POLICY "admin_write_cars" ON public.cars FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_tours" ON public.tours;
CREATE POLICY "public_read_tours" ON public.tours FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_tours" ON public.tours;
CREATE POLICY "admin_write_tours" ON public.tours FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_app_settings" ON public.app_settings;
CREATE POLICY "public_read_app_settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_app_settings" ON public.app_settings;
CREATE POLICY "admin_write_app_settings" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_availability_slots" ON public.availability_slots;
CREATE POLICY "public_read_availability_slots" ON public.availability_slots FOR SELECT TO anon, authenticated USING (true);

-- B) Tablas privadas: solo el administrador autenticado tiene acceso directo.
--    (La web pública inserta pre-reservas únicamente mediante la RPC create_public_booking_request)
DROP POLICY IF EXISTS "admin_all_reservations" ON public.reservations;
CREATE POLICY "admin_all_reservations" ON public.reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_car_reservations" ON public.car_reservations;
CREATE POLICY "admin_all_car_reservations" ON public.car_reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_tour_reservations" ON public.tour_reservations;
CREATE POLICY "admin_all_tour_reservations" ON public.tour_reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_referrers" ON public.referrers;
CREATE POLICY "admin_all_referrers" ON public.referrers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_notifications" ON public.admin_notifications;
CREATE POLICY "admin_all_notifications" ON public.admin_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. PUBLICACIÓN REALTIME (SINCRONIZACIÓN INSTANTÁNEA WEB <-> ADMIN)
-- ============================================================================

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'cabins',
        'cars',
        'tours',
        'app_settings',
        'availability_slots',
        'reservations',
        'car_reservations',
        'tour_reservations',
        'referrers',
        'admin_notifications'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;
