import { create } from 'zustand';
import {
  getSupabase,
  DEFAULT_BUSINESS_CONFIG,
  DEFAULT_PRICES,
  DEFAULT_SEASON_CONFIG,
  DEFAULT_DISCOUNT_CONFIG,
  DEFAULT_CABINS,
  DEFAULT_CARS,
  DEFAULT_TOURS
} from '@cabanas/shared';

const normalizeSlotRow = (row) => ({
  id: row.id,
  resourceType: row.resource_type,
  resourceId: String(row.resource_id),
  startDate: row.start_date,
  endDate: row.end_date
});

export const usePublicStore = create((set, get) => ({
  businessConfig: { ...DEFAULT_BUSINESS_CONFIG },
  prices: { ...DEFAULT_PRICES },
  seasonConfig: { ...DEFAULT_SEASON_CONFIG },
  discountConfig: { ...DEFAULT_DISCOUNT_CONFIG },

  cabins: DEFAULT_CABINS,
  cars: DEFAULT_CARS,
  tours: DEFAULT_TOURS,

  // Solo rangos de fechas ocupadas (sin nombres, teléfonos ni datos personales)
  occupiedCabinSlots: [],
  occupiedCarSlots: [],

  isLoading: false,
  isConnected: false,

  applySettingsRow: (row) => {
    if (!row) return;
    set((state) => ({
      businessConfig: row.business_config
        ? { ...state.businessConfig, ...row.business_config }
        : state.businessConfig,
      prices: row.prices
        ? { ...state.prices, ...row.prices }
        : state.prices,
      seasonConfig: row.season_config
        ? { ...state.seasonConfig, ...row.season_config }
        : state.seasonConfig,
      discountConfig: row.discount_config
        ? { ...state.discountConfig, ...row.discount_config }
        : state.discountConfig
    }));
  },

  fetchPublicData: async () => {
    const sb = getSupabase();
    if (!sb) return;

    set({ isLoading: true });

    try {
      // 1. Configuración global (tarifas, temporadas, descuentos, marca)
      const { data: settingsData, error: settingsError } = await sb
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (!settingsError && settingsData) {
        get().applySettingsRow(settingsData);
      }

      // 2. Catálogo de cabañas
      const { data: cabinsData, error: cabinsError } = await sb
        .from('cabins')
        .select('id, name, type, "maxCapacity", color');
      if (!cabinsError && cabinsData && cabinsData.length > 0) {
        set({ cabins: cabinsData });
      }

      // 3. Catálogo de vehículos activos
      const { data: carsData, error: carsError } = await sb
        .from('cars')
        .select('id, name, plate, "dailyRate", color, "isActive", "promoThresholdDays", "promoDailyRate"');
      if (!carsError && carsData) {
        set({ cars: carsData.filter((c) => c.isActive !== false) });
      }

      // 4. Catálogo de tours activos (opcional)
      const { data: toursData, error: toursError } = await sb
        .from('tours')
        .select('id, name, description, price, duration, "maxCapacity", color, "isActive"');
      if (!toursError && toursData) {
        set({ tours: toursData.filter((t) => t.isActive !== false) });
      }

      // 5. Disponibilidad pública segura sin PII (tabla availability_slots)
      const { data: slotsData, error: slotsError } = await sb
        .from('availability_slots')
        .select('id, resource_type, resource_id, start_date, end_date');

      if (!slotsError && slotsData) {
        const normalized = slotsData.map(normalizeSlotRow);
        set({
          occupiedCabinSlots: normalized.filter((s) => s.resourceType === 'cabin'),
          occupiedCarSlots: normalized.filter((s) => s.resourceType === 'car'),
          isConnected: true
        });
      } else if (slotsError?.code === '42P01' || slotsError?.code === 'PGRST205') {
        // Fallback temporal si todavía no se ejecuta supabase/schema.sql
        console.warn('[Web Pública] Tabla availability_slots no encontrada. Usando consulta de respaldo.');
        const [{ data: resData }, { data: carResData }] = await Promise.all([
          sb.from('reservations').select('id, "cabinId", "startDate", "endDate", status'),
          sb.from('car_reservations').select('id, "carId", "startDate", "endDate", status')
        ]);

        set({
          occupiedCabinSlots: (resData || [])
            .filter((r) => !['archived', 'cancelled', 'rejected'].includes(r.status))
            .map((r) => ({
              id: `cabin:${r.id}`,
              resourceType: 'cabin',
              resourceId: String(r.cabinId),
              startDate: r.startDate,
              endDate: r.endDate
            })),
          occupiedCarSlots: (carResData || [])
            .filter((r) => !['archived', 'cancelled', 'rejected'].includes(r.status))
            .map((r) => ({
              id: `car:${r.id}`,
              resourceType: 'car',
              resourceId: String(r.carId),
              startDate: r.startDate,
              endDate: r.endDate
            })),
          isConnected: true
        });
      }
    } catch (err) {
      console.error('[Web Pública] Error al sincronizar con Supabase:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  initRealtimeSubscription: () => {
    const sb = getSupabase();
    if (!sb) return null;

    const upsertItem = (list, item) => {
      const idx = list.findIndex((x) => String(x.id) === String(item.id));
      if (idx === -1) return [...list, item];
      return list.map((x) => (String(x.id) === String(item.id) ? { ...x, ...item } : x));
    };

    const removeItem = (list, id) => list.filter((x) => String(x.id) !== String(id));

    const channel = sb
      .channel('public-portal-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        (payload) => {
          if (payload.new?.id === 'default') {
            get().applySettingsRow(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cabins' },
        (payload) => {
          set((state) => {
            if (payload.eventType === 'DELETE') {
              return { cabins: removeItem(state.cabins, payload.old.id) };
            }
            return { cabins: upsertItem(state.cabins, payload.new) };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cars' },
        (payload) => {
          set((state) => {
            if (payload.eventType === 'DELETE' || payload.new?.isActive === false) {
              const targetId = payload.old?.id || payload.new?.id;
              return { cars: removeItem(state.cars, targetId) };
            }
            return { cars: upsertItem(state.cars, payload.new) };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'availability_slots' },
        (payload) => {
          set((state) => {
            if (payload.eventType === 'DELETE') {
              const oldId = payload.old.id;
              return {
                occupiedCabinSlots: removeItem(state.occupiedCabinSlots, oldId),
                occupiedCarSlots: removeItem(state.occupiedCarSlots, oldId)
              };
            }
            const slot = normalizeSlotRow(payload.new);
            if (slot.resourceType === 'cabin') {
              return { occupiedCabinSlots: upsertItem(state.occupiedCabinSlots, slot) };
            }
            if (slot.resourceType === 'car') {
              return { occupiedCarSlots: upsertItem(state.occupiedCarSlots, slot) };
            }
            return {};
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          set({ isConnected: true });
        }
      });

    return () => {
      sb.removeChannel(channel);
    };
  },

  /**
   * Envía una pre-reserva siempre en estado 'pending' (requiere aprobación manual en Admin).
   */
  submitBookingRequest: async ({
    cabinId,
    clientName,
    clientPhone,
    startDate,
    endDate,
    adults,
    childrenCount,
    babiesCount,
    totalCost,
    depositAmount,
    notes,
    carId,
    carStartDate,
    carEndDate,
    carTotalCost,
    carDepositAmount,
    notificationTitle,
    notificationMessage
  }) => {
    const sb = getSupabase();

    if (!sb) {
      // Modo demo sin variables de Supabase configuradas
      const demoId = `demo-${Date.now()}`;
      set((state) => ({
        occupiedCabinSlots: cabinId
          ? [
              ...state.occupiedCabinSlots,
              { id: `cabin:${demoId}`, resourceType: 'cabin', resourceId: String(cabinId), startDate, endDate }
            ]
          : state.occupiedCabinSlots,
        occupiedCarSlots:
          carId && carId !== 'none'
            ? [
                ...state.occupiedCarSlots,
                {
                  id: `car:${demoId}`,
                  resourceType: 'car',
                  resourceId: String(carId),
                  startDate: carStartDate || startDate,
                  endDate: carEndDate || endDate
                }
              ]
            : state.occupiedCarSlots
      }));
      return { ok: true, data: { cabinReservationId: demoId, status: 'pending' } };
    }

    // 1. Camino seguro principal: RPC atómica en Supabase
    const { data, error } = await sb.rpc('create_public_booking_request', {
      p_cabin_id: cabinId || null,
      p_client_name: clientName,
      p_client_phone: clientPhone,
      p_start_date: startDate,
      p_end_date: endDate,
      p_adults: Number(adults),
      p_children_count: Number(childrenCount),
      p_babies_count: Number(babiesCount),
      p_total_cost: Number(totalCost),
      p_deposit_amount: Number(depositAmount),
      p_notes: notes || '',
      p_car_id: carId && carId !== 'none' ? String(carId) : null,
      p_car_start_date: carStartDate || startDate,
      p_car_end_date: carEndDate || endDate,
      p_car_total_cost: Number(carTotalCost || 0),
      p_car_deposit_amount: Number(carDepositAmount || 0),
      p_notification_title: notificationTitle || 'Nueva Solicitud de Reserva Web',
      p_notification_message: notificationMessage || ''
    });

    if (!error) {
      // Actualización optimista de slots ocupados
      set((state) => {
        const nextCabinSlots =
          cabinId && data?.cabinReservationId
            ? [
                ...state.occupiedCabinSlots.filter((s) => s.id !== `cabin:${data.cabinReservationId}`),
                {
                  id: `cabin:${data.cabinReservationId}`,
                  resourceType: 'cabin',
                  resourceId: String(cabinId),
                  startDate,
                  endDate
                }
              ]
            : state.occupiedCabinSlots;

        const nextCarSlots =
          carId && carId !== 'none' && data?.carReservationId
            ? [
                ...state.occupiedCarSlots.filter((s) => s.id !== `car:${data.carReservationId}`),
                {
                  id: `car:${data.carReservationId}`,
                  resourceType: 'car',
                  resourceId: String(carId),
                  startDate: carStartDate || startDate,
                  endDate: carEndDate || endDate
                }
              ]
            : state.occupiedCarSlots;

        return { occupiedCabinSlots: nextCabinSlots, occupiedCarSlots: nextCarSlots };
      });
      return { ok: true, data };
    }

    // 2. Fallback si el usuario aún no ejecutó supabase/schema.sql (RPC no existe)
    const rpcMissing = error.code === 'PGRST202' || error.code === '42883';
    if (!rpcMissing) {
      return { ok: false, error: error.message || 'No se pudo registrar tu solicitud.' };
    }

    try {
      let cabinResId = null;
      if (cabinId) {
        cabinResId = Date.now().toString() + Math.random().toString(36).slice(2, 7);
        const { error: resErr } = await sb.from('reservations').insert([
          {
            id: cabinResId,
            cabinId,
            clientName,
            clientPhone,
            startDate,
            endDate,
            adults: Number(adults),
            childrenCount: Number(childrenCount),
            babiesCount: Number(babiesCount),
            totalCost: Number(totalCost),
            depositAmount: Number(depositAmount),
            paymentMethod: 'Por Confirmar',
            status: 'pending',
            notes: notes || ''
          }
        ]);
        if (resErr) return { ok: false, error: resErr.message };
      }

      if (carId && carId !== 'none') {
        const carResId = Date.now().toString() + Math.random().toString(36).slice(2, 7);
        await sb.from('car_reservations').insert([
          {
            id: carResId,
            carId,
            clientName,
            clientPhone,
            startDate: carStartDate || startDate,
            endDate: carEndDate || endDate,
            totalCost: Number(carTotalCost || 0),
            depositAmount: Number(carDepositAmount || 0),
            paymentMethod: 'Por Confirmar',
            status: 'pending',
            linkedCabinReservationId: cabinResId,
            notes: notes || ''
          }
        ]);
      }

      return { ok: true, data: { cabinReservationId: cabinResId, status: 'pending' } };
    } catch (fallbackErr) {
      return { ok: false, error: fallbackErr.message || 'Error de conexión al enviar la solicitud.' };
    }
  }
}));
