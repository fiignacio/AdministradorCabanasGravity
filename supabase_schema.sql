-- Borrar tablas si ya existen
DROP TABLE IF EXISTS public.car_reservations;
DROP TABLE IF EXISTS public.reservations;
DROP TABLE IF EXISTS public.cars;
DROP TABLE IF EXISTS public.cabins;

-- Crear tabla de cabañas
CREATE TABLE public.cabins (
    id text PRIMARY KEY,
    name text NOT NULL,
    type text NOT NULL,
    "maxCapacity" integer NOT NULL,
    color text NOT NULL
);

-- Crear tabla de reservas
CREATE TABLE public.reservations (
    id text PRIMARY KEY,
    "cabinId" text NOT NULL,
    "clientName" text,
    "startDate" text NOT NULL,
    "endDate" text NOT NULL,
    adults integer,
    "childrenCount" integer,
    "babiesCount" integer,
    "flightIn" text,
    "flightOut" text,
    "isBlock" boolean,
    "totalCost" numeric,
    status text NOT NULL,
);

-- Crear tabla de vehículos (Arriendos)
CREATE TABLE public.cars (
    id text PRIMARY KEY,
    name text NOT NULL,
    plate text NOT NULL,
    "dailyRate" numeric NOT NULL,
    color text NOT NULL,
    "isActive" boolean DEFAULT true,
    "promoThresholdDays" integer,
    "promoDailyRate" numeric
);

-- Crear tabla de reservas de vehículos
CREATE TABLE public.car_reservations (
    id text PRIMARY KEY,
    "carId" text NOT NULL,
    "clientName" text NOT NULL,
    "startDate" text NOT NULL,
    "endDate" text NOT NULL,
    "totalCost" numeric,
    status text NOT NULL,
    notes text,
    "linkedCabinReservationId" text -- Opcional: si está ligada a una cabaña
);

-- Habilitar RLS (Seguridad a Nivel de Fila)
ALTER TABLE public.cabins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo acceso anónimo cabañas" ON public.cabins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo acceso anónimo reservas" ON public.reservations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo acceso anónimo vehiculos" ON public.cars FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo acceso anónimo reservas_vehiculos" ON public.car_reservations FOR ALL USING (true) WITH CHECK (true);

-- Agregar columnas nuevas para Abonos (Update)
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "depositAmount" numeric;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "paymentMethod" text;
ALTER TABLE public.car_reservations ADD COLUMN IF NOT EXISTS "depositAmount" numeric;
ALTER TABLE public.car_reservations ADD COLUMN IF NOT EXISTS "paymentMethod" text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "notes" text;

-- Agregar columnas nuevas para Integración WhatsApp (Update)
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "clientPhone" text;
ALTER TABLE public.car_reservations ADD COLUMN IF NOT EXISTS "clientPhone" text;

-- Tabla de referentes (Agencias/Terceros)
CREATE TABLE IF NOT EXISTS public.referrers (
    id text PRIMARY KEY,
    name text NOT NULL,
    phone text,
    email text,
    "createdAt" text
);

ALTER TABLE public.referrers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo acceso anónimo referentes" ON public.referrers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "referrerId" text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "referrerStatus" text DEFAULT 'pending';


-- Storage Policies
-- Permitir subidas públicas al bucket 'quotes'
-- CREATE POLICY "Permitir subida de cotizaciones" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'quotes');

-- CRON JOB para eliminar PDFs antiguos (Requiere extensión pg_cron en Supabase)
-- Elimina los archivos de cotizaciones mayores a 7 días
/*
SELECT cron.schedule(
  'delete_old_quotes', -- nombre del trabajo
  '0 0 * * *',         -- todos los días a medianoche
  $$
    DELETE FROM storage.objects 
    WHERE bucket_id = 'quotes' 
    AND created_at < now() - interval '7 days';
  $$
);
*/
