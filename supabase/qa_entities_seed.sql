-- =================================================================
-- SCRIPT DE ENTIDADES DE QA / SEED DATA - ADMINISTRADOR DE CABAÑAS
-- Proyecto: Cabañas Manuara (AdministradorCabanasGravity)
-- Descripción: Conjunto completo de datos de prueba para validación QA de Cabañas Manuara
-- =================================================================

-- 1. CABAÑAS (Entidades de Cabañas con variaciones de capacidad y propietarios)
INSERT INTO public.cabins (id, name, type, "maxCapacity", color) VALUES
('CAB-101', 'Cabaña Volcán Rano Raraku', 'large', 8, '#D35400'),
('CAB-102', 'Cabaña Anakena Sun', 'small', 3, '#556B2F'),
('CAB-103', 'Cabaña Moai Sunset', 'medium', 5, '#B8860B'),
('CAB-104', 'Cabaña Tahai Wave', 'medium', 4, '#CD853F')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    "maxCapacity" = EXCLUDED."maxCapacity",
    color = EXCLUDED.color;

-- 2. REFERENTES / AGENCIAS (Entidades de Agencias de Viaje y Canales Directos)
INSERT INTO public.referrers (id, name, phone, email, "createdAt") VALUES
('REF-601', 'Agencia Viajes Rapa Nui Travel', '+56987654321', 'contacto@rapanuitravel.cl', '2026-08-01T10:00:00.000Z'),
('REF-602', 'Guía Independiente Hitori', '+56955512345', 'hitori.tours@gmail.com', '2026-08-15T14:30:00.000Z')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email;

-- 3. RESERVAS DE CABAÑAS (Escenarios: Confirmada, Bloqueada, Con Referente, Abono Parcial)
INSERT INTO public.reservations (
    id, "cabinId", "clientName", "clientPhone", "startDate", "endDate", 
    adults, "childrenCount", "babiesCount", "flightIn", "flightOut", 
    "isBlock", "totalCost", "depositAmount", "paymentMethod", status, notes, "referrerId", "referrerStatus"
) VALUES
(
    'RES-1001', 'CAB-101', 'Carlos Mendoza', '+56912345678', '2026-10-01', '2026-10-06',
    4, 2, 0, 'LA841', 'LA842',
    false, 450000, 150000, 'Transferencia', 'confirmed', 'Pasajeros solicitan cuna adicional para bebé', 'REF-601', 'pending'
),
(
    'RES-1002', 'CAB-102', 'Mantenimiento Fontanería', NULL, '2026-10-10', '2026-10-12',
    0, 0, 0, NULL, NULL,
    true, 0, 0, NULL, 'confirmed', 'Bloqueo técnico por mantenimiento programado de cañerías', NULL, 'none'
),
(
    'RES-1003', 'CAB-103', 'María José Silva', '+56998765432', '2026-10-03', '2026-10-08',
    2, 1, 1, 'LA843', 'LA844',
    false, 320000, 320000, 'Efectivo', 'confirmed', 'Pagado 100% al check-in por adelantado', 'REF-602', 'paid'
)
ON CONFLICT (id) DO UPDATE SET
    "clientName" = EXCLUDED."clientName",
    "startDate" = EXCLUDED."startDate",
    "endDate" = EXCLUDED."endDate",
    "totalCost" = EXCLUDED."totalCost",
    "depositAmount" = EXCLUDED."depositAmount";

-- 4. VEHÍCULOS (Entidades de Fleet Auto con Tarifas Normales y Tarifas Promocionales)
INSERT INTO public.cars (id, name, plate, "dailyRate", color, "isActive", "promoThresholdDays", "promoDailyRate") VALUES
('CAR-201', 'Suzuki Jimny 4x4 Green', 'HV-88-21', 45000, '#27ae60', true, 4, 40000),
('CAR-202', 'Toyota RAV4 SUV Blue', 'K7-99-32', 65000, '#2980b9', true, 0, 0),
('CAR-203', 'Jeep Wrangler Red (Taller)', 'TR-55-11', 85000, '#e74c3c', false, 5, 75000)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    plate = EXCLUDED.plate,
    "dailyRate" = EXCLUDED."dailyRate",
    "promoThresholdDays" = EXCLUDED."promoThresholdDays",
    "promoDailyRate" = EXCLUDED."promoDailyRate";

-- 5. RESERVAS DE VEHÍCULOS (Escenarios: Vinculada a Cabaña vs Independiente)
INSERT INTO public.car_reservations (
    id, "carId", "clientName", "clientPhone", "startDate", "endDate", 
    "totalCost", "depositAmount", "paymentMethod", status, notes, "linkedCabinReservationId"
) VALUES
(
    'CRES-301', 'CAR-201', 'Carlos Mendoza', '+56912345678', '2026-10-01', '2026-10-06',
    200000, 50000, 'Transferencia', 'confirmed', 'Vehículo entregado con estanque lleno', 'RES-1001'
),
(
    'CRES-302', 'CAR-202', 'Laura Gutiérrez', '+56944443333', '2026-10-05', '2026-10-08',
    195000, 195000, 'Tarjeta de Crédito', 'confirmed', 'Arriendo directo sin alojamiento en cabaña', NULL
)
ON CONFLICT (id) DO UPDATE SET
    "totalCost" = EXCLUDED."totalCost",
    "depositAmount" = EXCLUDED."depositAmount";

-- 6. TOURS Y EXCURSIONES (Entidades de Tours con Capacidades y Duraciones)
INSERT INTO public.tours (id, name, description, price, duration, "maxCapacity", color, "isActive") VALUES
('TOUR-401', 'Tour Rapa Nui Completo - Ahu Tongariki & Rano Raraku', 'Recorrido histórico por los sitios sagrados de moais y cantera', 75000, '1 Día Completo', 14, '#8e44ad', true),
('TOUR-402', 'Trekking Volcán Terevaka al Atardecer', 'Caminata guiada al punto más alto de la isla', 40000, '4 Horas', 10, '#e67e22', true),
('TOUR-403', 'Tour Snorkel & Cueva Ana Kakenga', 'Exploración marina y cuevas volcánicas en la costa', 50000, '3 Horas', 8, '#16a085', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    "maxCapacity" = EXCLUDED."maxCapacity";

-- 7. RESERVAS DE TOURS (Escenarios: Reserva por Grupo y Límite de Capacidad)
INSERT INTO public.tour_reservations (
    id, "tourId", "clientName", "clientPhone", date, time, "paxCount", "totalCost", status, notes
) VALUES
(
    'TRES-501', 'TOUR-401', 'Carlos Mendoza', '+56912345678', '2026-10-03', '09:00',
    4, 300000, 'confirmed', 'Grupo familiar de la Cabaña Volcán'
),
(
    'TRES-502', 'TOUR-402', 'Agustín Morales', '+56977778888', '2026-10-04', '16:00',
    10, 400000, 'confirmed', 'Grupo completo ocupa 100% de la capacidad del tour'
)
ON CONFLICT (id) DO UPDATE SET
    "paxCount" = EXCLUDED."paxCount",
    "totalCost" = EXCLUDED."totalCost";
