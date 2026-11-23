import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

export { getSupabase };

const syncAppSettingsToSupabase = (state) => {
  const sb = getSupabase(state.syncConfig);
  if (!sb) return;

  const payload = {
    id: 'default',
    business_config: state.businessConfig,
    prices: state.prices,
    season_config: state.seasonConfig,
    discount_config: state.discountConfig,
    updated_at: new Date().toISOString()
  };

  sb.from('app_settings')
    .upsert([payload], { onConflict: 'id' })
    .then(({ error }) => {
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          console.warn('[Supabase Sync] Tabla app_settings aún no creada. Ejecuta supabase/schema.sql para sincronizar tarifas y marca con la web pública.');
        } else {
          console.error('[Supabase Sync] Error guardando app_settings:', error);
        }
      }
    })
    .catch((err) => console.warn('[Supabase Sync] Excepción guardando app_settings:', err));
};

export const useStore = create(
  persist(
    (set, get) => ({
      // BUSINESS CONFIG & PERSONALIZATION (sincronizado con Supabase app_settings)
      businessConfig: { ...DEFAULT_BUSINESS_CONFIG },
      updateBusinessConfig: (newConfig) => {
        set((state) => ({
          businessConfig: { ...state.businessConfig, ...newConfig }
        }));
        syncAppSettingsToSupabase(get());
      },
      resetSetup: () => {
        set((state) => ({
          businessConfig: { ...state.businessConfig, isSetupCompleted: false }
        }));
      },

      prices: { ...DEFAULT_PRICES },
      updatePrices: (newPrices) => {
        set((state) => ({
          prices: { ...state.prices, ...newPrices }
        }));
        syncAppSettingsToSupabase(get());
      },

      // CONFIGURACIÓN DE TEMPORADAS (sincronizado con Supabase app_settings)
      seasonConfig: { ...DEFAULT_SEASON_CONFIG },
      updateSeasonConfig: (newSeasonConfig) => {
        set((state) => ({
          seasonConfig: { ...state.seasonConfig, ...newSeasonConfig }
        }));
        syncAppSettingsToSupabase(get());
      },

      // CONFIGURACIÓN DE DESCUENTOS (sincronizado con Supabase app_settings)
      discountConfig: { ...DEFAULT_DISCOUNT_CONFIG },
      updateDiscountConfig: (newDiscountConfig) => {
        set((state) => ({
          discountConfig: { ...state.discountConfig, ...newDiscountConfig }
        }));
        syncAppSettingsToSupabase(get());
      },

      // NOTIFICACIONES INTERNAS RECIBIDAS DESDE LA WEB PÚBLICA
      adminNotifications: [],
      markNotificationRead: (id) => {
        set((state) => ({
          adminNotifications: state.adminNotifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          )
        }));
        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('admin_notifications')
            .update({ read: true })
            .eq('id', id)
            .then(({ error }) => {
              if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
                console.warn('[Supabase Sync] Error marcando notificación como leída:', error);
              }
            });
        }
      },
      markAllNotificationsRead: () => {
        const unreadIds = get().adminNotifications.filter((n) => !n.read).map((n) => n.id);
        set((state) => ({
          adminNotifications: state.adminNotifications.map((n) => ({ ...n, read: true }))
        }));
        const sb = getSupabase(get().syncConfig);
        if (sb && unreadIds.length > 0) {
          sb.from('admin_notifications')
            .update({ read: true })
            .in('id', unreadIds)
            .then(({ error }) => {
              if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
                console.warn('[Supabase Sync] Error marcando notificaciones como leídas:', error);
              }
            });
        }
      },

      // OFFLINE QUEUE
      offlineQueue: [],
      addToOfflineQueue: (actionType, table, payload, originalId) => {
        set((state) => ({
          offlineQueue: [
            ...state.offlineQueue,
            {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
              timestamp: Date.now(),
              actionType,
              table,
              payload,
              originalId
            }
          ]
        }));
      },
      removeFromOfflineQueue: (id) => {
        set((state) => ({ offlineQueue: state.offlineQueue.filter((item) => item.id !== id) }));
      },
      handleMutationResponse: (error, actionType, table, payload, originalId) => {
        if (error) {
          const msg = error.message || '';
          if (
            msg.includes('Failed to fetch') ||
            msg.includes('Could not find the table') ||
            error.code === '42P01' ||
            error.code === 'PGRST205'
          ) {
            console.warn(`[Supabase Sync] Tabla '${table}' pendiente de creación en Supabase o sin conexión. Guardando localmente.`);
            get().addToOfflineQueue(actionType, table, payload, originalId);
          } else {
            console.error(error);
            alert(`Error base de datos (${table}): ${error.message}`);
          }
        }
      },
      processOfflineQueue: async () => {
        const queue = get().offlineQueue;
        if (queue.length === 0) return;

        const sb = getSupabase(get().syncConfig);
        if (!sb) return;

        console.log(`Procesando ${queue.length} operaciones offline...`);

        let newQueue = [...queue];

        for (let i = 0; i < queue.length; i++) {
          const item = queue[i];
          let error = null;

          try {
            if (item.actionType === 'INSERT') {
              const { error: err } = await sb.from(item.table).insert([item.payload]);
              error = err;
            } else if (item.actionType === 'UPDATE') {
              const { error: err } = await sb.from(item.table).update(item.payload).eq('id', item.originalId);
              error = err;
            } else if (item.actionType === 'DELETE') {
              const { error: err } = await sb.from(item.table).delete().eq('id', item.originalId);
              error = err;
            }

            const isNetworkError = error?.message?.includes('Failed to fetch') || error?.status === 0;

            if (!error || error.code === '23505') {
              newQueue = newQueue.filter((q) => q.id !== item.id);
            } else if (isNetworkError) {
              console.warn('[Supabase Sync] Sin conexión de red. Pausando cola offline.');
              break;
            } else {
              console.error('[Supabase Sync] Error no recuperable en ítem de la cola (se descarta para evitar bloqueo):', item, error);
              newQueue = newQueue.filter((q) => q.id !== item.id);
            }
          } catch (err) {
            console.error('[Supabase Sync] Excepción general sincronizando ítem:', err);
            break;
          }
        }

        set({ offlineQueue: newQueue });
      },

      cabins: DEFAULT_CABINS,
      addCabin: (cabin) => {
        const newCabin = { ...cabin, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ cabins: [...state.cabins, newCabin] }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('cabins')
            .insert([newCabin])
            .then(({ error }) => get().handleMutationResponse(error, 'INSERT', 'cabins', newCabin))
            .catch((e) => get().handleMutationResponse(e, 'INSERT', 'cabins', newCabin));
        }
      },
      updateCabin: (id, updatedData) => {
        set((state) => ({ cabins: state.cabins.map((c) => (c.id === id ? { ...c, ...updatedData } : c)) }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('cabins')
            .update(updatedData)
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'UPDATE', 'cabins', updatedData, id))
            .catch((e) => get().handleMutationResponse(e, 'UPDATE', 'cabins', updatedData, id));
        }
      },
      deleteCabin: (id) => {
        set((state) => ({ cabins: state.cabins.filter((c) => c.id !== id) }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('cabins')
            .delete()
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'DELETE', 'cabins', null, id))
            .catch((e) => get().handleMutationResponse(e, 'DELETE', 'cabins', null, id));
        }
      },

      reservations: [],
      addReservation: (reservation) => {
        const newRes = { ...reservation, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ reservations: [...state.reservations, newRes] }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('reservations')
            .insert([newRes])
            .then(({ error }) => get().handleMutationResponse(error, 'INSERT', 'reservations', newRes))
            .catch((e) => get().handleMutationResponse(e, 'INSERT', 'reservations', newRes));
        }

        return newRes.id;
      },
      updateReservation: (id, updatedData) => {
        set((state) => ({
          reservations: state.reservations.map((res) => (res.id === id ? { ...res, ...updatedData } : res))
        }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('reservations')
            .update(updatedData)
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'UPDATE', 'reservations', updatedData, id))
            .catch((e) => get().handleMutationResponse(e, 'UPDATE', 'reservations', updatedData, id));
        }
      },
      deleteReservation: (id) => {
        set((state) => ({ reservations: state.reservations.filter((res) => res.id !== id) }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('reservations')
            .delete()
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'DELETE', 'reservations', null, id))
            .catch((e) => get().handleMutationResponse(e, 'DELETE', 'reservations', null, id));
        }
      },

      // CARS
      cars: DEFAULT_CARS,
      addCar: (car) => {
        const newCar = { ...car, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ cars: [...state.cars, newCar] }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('cars')
            .insert([newCar])
            .then(({ error }) => get().handleMutationResponse(error, 'INSERT', 'cars', newCar))
            .catch((e) => get().handleMutationResponse(e, 'INSERT', 'cars', newCar));
        }
      },
      updateCar: (id, updatedData) => {
        set((state) => ({ cars: state.cars.map((c) => (c.id === id ? { ...c, ...updatedData } : c)) }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('cars')
            .update(updatedData)
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'UPDATE', 'cars', updatedData, id))
            .catch((e) => get().handleMutationResponse(e, 'UPDATE', 'cars', updatedData, id));
        }
      },
      deleteCar: (id) => {
        set((state) => ({ cars: state.cars.filter((c) => c.id !== id) }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('cars')
            .delete()
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'DELETE', 'cars', null, id))
            .catch((e) => get().handleMutationResponse(e, 'DELETE', 'cars', null, id));
        }
      },

      // CAR RESERVATIONS
      carReservations: [],
      addCarReservation: (res) => {
        const newRes = { ...res, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ carReservations: [...state.carReservations, newRes] }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('car_reservations')
            .insert([newRes])
            .then(({ error }) => get().handleMutationResponse(error, 'INSERT', 'car_reservations', newRes))
            .catch((e) => get().handleMutationResponse(e, 'INSERT', 'car_reservations', newRes));
        }
      },
      updateCarReservation: (id, updatedData) => {
        set((state) => ({
          carReservations: state.carReservations.map((r) => (r.id === id ? { ...r, ...updatedData } : r))
        }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('car_reservations')
            .update(updatedData)
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'UPDATE', 'car_reservations', updatedData, id))
            .catch((e) => get().handleMutationResponse(e, 'UPDATE', 'car_reservations', updatedData, id));
        }
      },
      deleteCarReservation: (id) => {
        set((state) => ({ carReservations: state.carReservations.filter((r) => r.id !== id) }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('car_reservations')
            .delete()
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'DELETE', 'car_reservations', null, id))
            .catch((e) => get().handleMutationResponse(e, 'DELETE', 'car_reservations', null, id));
        }
      },

      // TOURS
      tours: DEFAULT_TOURS,
      addTour: (tour) => {
        const newTour = { ...tour, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ tours: [...state.tours, newTour] }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('tours')
            .insert([newTour])
            .then(({ error }) => get().handleMutationResponse(error, 'INSERT', 'tours', newTour))
            .catch((e) => get().handleMutationResponse(e, 'INSERT', 'tours', newTour));
        }
      },
      updateTour: (id, updatedData) => {
        set((state) => ({ tours: state.tours.map((t) => (t.id === id ? { ...t, ...updatedData } : t)) }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('tours')
            .update(updatedData)
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'UPDATE', 'tours', updatedData, id))
            .catch((e) => get().handleMutationResponse(e, 'UPDATE', 'tours', updatedData, id));
        }
      },
      deleteTour: (id) => {
        set((state) => ({ tours: state.tours.filter((t) => t.id !== id) }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('tours')
            .delete()
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'DELETE', 'tours', null, id))
            .catch((e) => get().handleMutationResponse(e, 'DELETE', 'tours', null, id));
        }
      },

      // TOUR RESERVATIONS
      tourReservations: [],
      addTourReservation: (res) => {
        const newRes = { ...res, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ tourReservations: [...state.tourReservations, newRes] }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('tour_reservations')
            .insert([newRes])
            .then(({ error }) => get().handleMutationResponse(error, 'INSERT', 'tour_reservations', newRes))
            .catch((e) => get().handleMutationResponse(e, 'INSERT', 'tour_reservations', newRes));
        }
      },
      updateTourReservation: (id, updatedData) => {
        set((state) => ({
          tourReservations: state.tourReservations.map((r) => (r.id === id ? { ...r, ...updatedData } : r))
        }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('tour_reservations')
            .update(updatedData)
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'UPDATE', 'tour_reservations', updatedData, id))
            .catch((e) => get().handleMutationResponse(e, 'UPDATE', 'tour_reservations', updatedData, id));
        }
      },
      deleteTourReservation: (id) => {
        set((state) => ({ tourReservations: state.tourReservations.filter((r) => r.id !== id) }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('tour_reservations')
            .delete()
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'DELETE', 'tour_reservations', null, id))
            .catch((e) => get().handleMutationResponse(e, 'DELETE', 'tour_reservations', null, id));
        }
      },

      // REFERRERS (Agencias/Clientes)
      referrers: [],
      addReferrer: (referrer) => {
        const newRef = { ...referrer, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ referrers: [...state.referrers, newRef] }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('referrers')
            .insert([newRef])
            .then(({ error }) => get().handleMutationResponse(error, 'INSERT', 'referrers', newRef))
            .catch((e) => get().handleMutationResponse(e, 'INSERT', 'referrers', newRef));
        }

        return newRef.id;
      },
      updateReferrer: (id, updatedData) => {
        set((state) => ({
          referrers: state.referrers.map((r) => (r.id === id ? { ...r, ...updatedData } : r))
        }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('referrers')
            .update(updatedData)
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'UPDATE', 'referrers', updatedData, id))
            .catch((e) => get().handleMutationResponse(e, 'UPDATE', 'referrers', updatedData, id));
        }
      },
      deleteReferrer: (id) => {
        set((state) => ({ referrers: state.referrers.filter((r) => r.id !== id) }));

        const sb = getSupabase(get().syncConfig);
        if (sb) {
          sb.from('referrers')
            .delete()
            .eq('id', id)
            .then(({ error }) => get().handleMutationResponse(error, 'DELETE', 'referrers', null, id))
            .catch((e) => get().handleMutationResponse(e, 'DELETE', 'referrers', null, id));
        }
      },

      // Sync Configurations
      syncConfig: {
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
        supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        googleClientId: ''
      },
      updateSyncConfig: (newConfig) =>
        set((state) => ({
          syncConfig: { ...state.syncConfig, ...newConfig }
        })),

      // Auth State
      user: null,
      session: null,
      authError: null,
      isAuthChecking: true,

      login: async (email, password) => {
        const sb = getSupabase(get().syncConfig);

        // Modo demo local si Supabase no está configurado
        if (!sb) {
          if (email && password) {
            const mockUser = { id: 'admin-local-1', email: email.toLowerCase(), role: 'admin', isLocal: true };
            const mockSession = { access_token: 'local-admin-session', user: mockUser };
            set({ user: mockUser, session: mockSession, authError: null });
            return true;
          }
          set({ authError: 'Ingrese usuario y contraseña válidos' });
          return false;
        }

        try {
          const { data, error } = await sb.auth.signInWithPassword({ email, password });
          if (error) {
            set({
              authError:
                error.message === 'Invalid login credentials'
                  ? 'Credenciales inválidas. Verifica el usuario creado en Supabase Authentication.'
                  : error.message || 'Error de autenticación'
            });
            return false;
          }
          set({ user: data.user, session: data.session, authError: null });
          // Cargar datos inmediatamente con la sesión autenticada (requerido para RLS)
          get().fetchFromSupabase();
          return true;
        } catch (err) {
          set({ authError: err.message });
          return false;
        }
      },

      logout: async () => {
        const sb = getSupabase(get().syncConfig);
        if (sb) {
          try {
            await sb.auth.signOut();
          } catch (e) {
            console.warn('SignOut error:', e);
          }
        }
        set({ user: null, session: null, authError: null });
      },

      checkSession: async () => {
        const sb = getSupabase(get().syncConfig);
        if (!sb) {
          set({ isAuthChecking: false });
          return;
        }

        try {
          const {
            data: { session }
          } = await sb.auth.getSession();

          if (session) {
            set({ session, user: session.user || null, isAuthChecking: false });
          } else {
            set({ session: null, user: null, isAuthChecking: false });
          }

          sb.auth.onAuthStateChange((_event, nextSession) => {
            if (nextSession) {
              set({ session: nextSession, user: nextSession.user || null });
              get().fetchFromSupabase();
            } else {
              set({ session: null, user: null });
            }
          });
        } catch (err) {
          console.warn('CheckSession error:', err);
          set({ isAuthChecking: false });
        }
      },

      // Pull from Supabase
      fetchFromSupabase: async () => {
        const sb = getSupabase(get().syncConfig);
        if (!sb) return;

        console.log('Iniciando sincronización Admin con Supabase...');

        // 0. Configuración global (app_settings)
        const { data: settingsData, error: settingsError } = await sb
          .from('app_settings')
          .select('*')
          .eq('id', 'default')
          .maybeSingle();

        if (settingsError && settingsError.code !== 'PGRST205' && settingsError.code !== '42P01') {
          console.warn('Info app_settings:', settingsError.message);
        } else if (settingsData) {
          set((state) => ({
            businessConfig: settingsData.business_config
              ? { ...state.businessConfig, ...settingsData.business_config }
              : state.businessConfig,
            prices: settingsData.prices ? { ...state.prices, ...settingsData.prices } : state.prices,
            seasonConfig: settingsData.season_config
              ? { ...state.seasonConfig, ...settingsData.season_config }
              : state.seasonConfig,
            discountConfig: settingsData.discount_config
              ? { ...state.discountConfig, ...settingsData.discount_config }
              : state.discountConfig
          }));
        }

        const { data: cabinsData, error: cabinsError } = await sb.from('cabins').select('*');
        if (cabinsError) console.error('Error al obtener cabañas:', cabinsError);
        else if (cabinsData) set({ cabins: cabinsData });

        const { data: resData, error: resError } = await sb.from('reservations').select('*');
        if (resError) console.error('Error al obtener reservas:', resError);
        else if (resData) set({ reservations: resData });

        const { data: carsData, error: carsError } = await sb.from('cars').select('*');
        if (carsError) console.error('Error cars:', carsError);
        else if (carsData) set({ cars: carsData });

        const { data: carResData, error: carResError } = await sb.from('car_reservations').select('*');
        if (carResError) console.error('Error car reservations:', carResError);
        else if (carResData) set({ carReservations: carResData });

        const { data: toursData, error: toursError } = await sb.from('tours').select('*');
        if (toursError && toursError.code !== 'PGRST205' && toursError.code !== '42P01') {
          console.warn('Info tours:', toursError.message);
        } else if (toursData) set({ tours: toursData });

        const { data: tourResData, error: tourResError } = await sb.from('tour_reservations').select('*');
        if (tourResError && tourResError.code !== 'PGRST205' && tourResError.code !== '42P01') {
          console.warn('Info tour reservations:', tourResError.message);
        } else if (tourResData) set({ tourReservations: tourResData });

        const { data: refData, error: refError } = await sb.from('referrers').select('*');
        if (refError && refError.code !== 'PGRST205' && refError.code !== '42P01') {
          console.error('Error referrers:', refError);
        } else if (refData) set({ referrers: refData });

        // Notificaciones internas desde la web pública
        const { data: notifData, error: notifError } = await sb
          .from('admin_notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30);
        if (notifError && notifError.code !== 'PGRST205' && notifError.code !== '42P01') {
          console.warn('Info admin_notifications:', notifError.message);
        } else if (notifData) set({ adminNotifications: notifData });
      },

      // Realtime Sync
      initRealtimeSubscription: () => {
        const sb = getSupabase(get().syncConfig);
        if (!sb) return null;

        console.log('Iniciando suscripciones Admin en tiempo real...');

        const handleRealtimeEvent = (table, stateKey) => (payload) => {
          if (payload.eventType === 'INSERT') {
            const clientName = payload.new?.clientName || payload.new?.client_name || 'Nuevo cliente';
            let msgTitle = '🔔 Nueva Actividad en Cabañas Manuara';
            let msgBody = `Se ha registrado un nuevo elemento en ${table}.`;
            let shouldNotify = false;

            if (table === 'reservations') {
              msgTitle = '🏡 Nueva Reserva de Cabaña';
              msgBody = `${clientName} ha realizado una ${payload.new?.status === 'pending' ? 'pre-reserva web pendiente' : 'reserva'}.`;
              shouldNotify = true;
            } else if (table === 'car_reservations') {
              msgTitle = '🚗 Nueva Reserva de Vehículo';
              msgBody = `${clientName} ha reservado un vehículo.`;
              shouldNotify = true;
            } else if (table === 'tour_reservations') {
              msgTitle = '🗿 Nueva Reserva de Tour';
              msgBody = `${clientName} ha reservado una excursión.`;
              shouldNotify = true;
            }

            if (shouldNotify) {
              import('../utils/notifications').then(({ sendNativeNotification }) => {
                sendNativeNotification(msgTitle, msgBody);
              });
            }
          }

          set((state) => {
            const currentList = state[stateKey] || [];
            let newList = [...currentList];

            if (payload.eventType === 'INSERT') {
              if (!newList.find((item) => item.id === payload.new.id)) {
                if (stateKey === 'adminNotifications') {
                  newList.unshift(payload.new);
                } else {
                  newList.push(payload.new);
                }
              }
            } else if (payload.eventType === 'UPDATE') {
              newList = newList.map((item) => (item.id === payload.new.id ? { ...item, ...payload.new } : item));
            } else if (payload.eventType === 'DELETE') {
              newList = newList.filter((item) => item.id !== payload.old.id);
            }

            return { [stateKey]: newList };
          });
        };

        const channel = sb
          .channel('admin-panel-all')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, handleRealtimeEvent('reservations', 'reservations'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'cabins' }, handleRealtimeEvent('cabins', 'cabins'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'cars' }, handleRealtimeEvent('cars', 'cars'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'car_reservations' }, handleRealtimeEvent('car_reservations', 'carReservations'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tours' }, handleRealtimeEvent('tours', 'tours'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tour_reservations' }, handleRealtimeEvent('tour_reservations', 'tourReservations'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'referrers' }, handleRealtimeEvent('referrers', 'referrers'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications' }, handleRealtimeEvent('admin_notifications', 'adminNotifications'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
            if (payload.new?.id === 'default') {
              set((state) => ({
                businessConfig: payload.new.business_config
                  ? { ...state.businessConfig, ...payload.new.business_config }
                  : state.businessConfig,
                prices: payload.new.prices ? { ...state.prices, ...payload.new.prices } : state.prices,
                seasonConfig: payload.new.season_config
                  ? { ...state.seasonConfig, ...payload.new.season_config }
                  : state.seasonConfig,
                discountConfig: payload.new.discount_config
                  ? { ...state.discountConfig, ...payload.new.discount_config }
                  : state.discountConfig
              }));
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Panel Admin conectado a Supabase Realtime');
            }
          });

        return () => {
          sb.removeChannel(channel);
        };
      }
    }),
    {
      name: 'cabin-admin-storage'
    }
  )
);
