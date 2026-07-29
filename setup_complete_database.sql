-- SCRIPT DE CONFIGURACIÓN COMPLETA PARA SUPABASE
-- Copia todo este código, ve a tu panel de Supabase > SQL Editor, pégalo y haz clic en "Run"

-- 1. Tabla de Cabañas
CREATE TABLE IF NOT EXISTS public.cabins (
    id text PRIMARY KEY,
    name text NOT NULL,
    type text DEFAULT 'standard',
    "maxCapacity" integer DEFAULT 4,
    color text DEFAULT '#2980b9'
);

-- 2. Tabla de Reservas de Cabañas
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
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. Tabla de Vehículos (Arriendos)
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

-- 4. Tabla de Reservas de Vehículos
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

-- 5. Tabla de Tours y Excursiones
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

-- 6. Tabla de Reservas de Tours
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

-- HABILITAR SEGURIDAD (RLS) Y PERMISOS ABIERTOS DE LECTURA/ESCRITURA
ALTER TABLE public.cabins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo acceso cabañas" ON public.cabins;
CREATE POLICY "Permitir todo acceso cabañas" ON public.cabins FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo acceso reservas" ON public.reservations;
CREATE POLICY "Permitir todo acceso reservas" ON public.reservations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo acceso vehiculos" ON public.cars;
CREATE POLICY "Permitir todo acceso vehiculos" ON public.cars FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo acceso reservas vehiculos" ON public.car_reservations;
CREATE POLICY "Permitir todo acceso reservas vehiculos" ON public.car_reservations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo acceso tours" ON public.tours;
CREATE POLICY "Permitir todo acceso tours" ON public.tours FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo acceso reservas tours" ON public.tour_reservations;
CREATE POLICY "Permitir todo acceso reservas tours" ON public.tour_reservations FOR ALL USING (true) WITH CHECK (true);

