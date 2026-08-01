import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient } from '@supabase/supabase-js';

// Helper function to get supabase instance if configured
export const getSupabase = (config) => {
  const url = import.meta.env.VITE_SUPABASE_URL || config?.supabaseUrl;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || config?.supabaseKey;
  if (url && key) {
    return createClient(url, key);
  }
  return null;
};

export const useStore = create(
  persist(
    (set, get) => ({
      // BUSINESS CONFIG & PERSONALIZATION
      businessConfig: {
        businessName: 'Mi Complejo de Cabañas',
        administratorName: 'Administrador Principal',
        primaryColor: '#2c4c3b',
        contactPhone: '',
        contactEmail: '',
        logoUrl: '',
        isSetupCompleted: false
      },
      updateBusinessConfig: (newConfig) => set((state) => ({
        businessConfig: { ...state.businessConfig, ...newConfig }
      })),
      resetSetup: () => set((state) => ({
        businessConfig: { ...state.businessConfig, isSetupCompleted: false }
      })),

      prices: {
        highSeasonAdult: 35000,
        lowSeasonAdult: 30000,
        child: 15000,
      },
      updatePrices: (newPrices) => set((state) => ({
        prices: { ...state.prices, ...newPrices }
      })),
      
      // OFFLINE QUEUE
      offlineQueue: [],
      addToOfflineQueue: (actionType, table, payload, originalId) => {
        set(state => ({
          offlineQueue: [...state.offlineQueue, {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            timestamp: Date.now(),
            actionType,
            table,
            payload,
            originalId
          }]
        }));
      },
      removeFromOfflineQueue: (id) => {
        set(state => ({ offlineQueue: state.offlineQueue.filter(item => item.id !== id) }));
      },
      handleMutationResponse: (error, actionType, table, payload, originalId) => {
        if (error) {
          const msg = error.message || '';
          if (msg.includes('Failed to fetch') || msg.includes('Could not find the table') || error.code === '42P01' || error.code === 'PGRST205') {
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
            
            // 23505 is Unique Violation (already inserted)
            if (!error || error.code === '23505') {
              newQueue = newQueue.filter(q => q.id !== item.id);
            } else {
              console.error("Fallo al sincronizar item", item, error);
              break; // Stop if there's a real error (like no internet again)
            }
          } catch (err) {
            console.error("Fallo general sincronizando item", err);
            break;
          }
        }
        
        set({ offlineQueue: newQueue });
      },

      cabins: [
        { id: '1', name: 'Cabaña Grande', type: 'large', maxCapacity: 6, color: '#D35400', owner: 'Dueño 1' },
        { id: '2', name: 'Cabaña Pequeña', type: 'small', maxCapacity: 3, color: '#556B2F', owner: 'Dueño 1' },
        { id: '3', name: 'Cabaña Mediana 1', type: 'medium', maxCapacity: 4, color: '#B8860B', owner: 'Dueño 2' },
        { id: '4', name: 'Cabaña Mediana 2', type: 'medium', maxCapacity: 4, color: '#CD853F', owner: 'Dueño 2' }
      ],
      addCabin: (cabin) => {
        const newCabin = { ...cabin, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ cabins: [...state.cabins, newCabin] }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('cabins').insert([newCabin])
          .then(({error}) => get().handleMutationResponse(error, 'INSERT', 'cabins', newCabin))
          .catch(e => get().handleMutationResponse(e, 'INSERT', 'cabins', newCabin));
      },
      updateCabin: (id, updatedData) => {
        set((state) => ({ cabins: state.cabins.map(c => c.id === id ? { ...c, ...updatedData } : c) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('cabins').update(updatedData).eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'UPDATE', 'cabins', updatedData, id))
          .catch(e => get().handleMutationResponse(e, 'UPDATE', 'cabins', updatedData, id));
      },
      deleteCabin: (id) => {
        set((state) => ({ cabins: state.cabins.filter(c => c.id !== id) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('cabins').delete().eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'DELETE', 'cabins', null, id))
          .catch(e => get().handleMutationResponse(e, 'DELETE', 'cabins', null, id));
      },
      
      reservations: [],
      addReservation: (reservation) => {
        const newRes = { ...reservation, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ reservations: [...state.reservations, newRes] }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('reservations').insert([newRes])
          .then(({error}) => get().handleMutationResponse(error, 'INSERT', 'reservations', newRes))
          .catch(e => get().handleMutationResponse(e, 'INSERT', 'reservations', newRes));
          
        return newRes.id;
      },
      updateReservation: (id, updatedData) => {
        set((state) => ({ reservations: state.reservations.map(res => res.id === id ? { ...res, ...updatedData } : res) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('reservations').update(updatedData).eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'UPDATE', 'reservations', updatedData, id))
          .catch(e => get().handleMutationResponse(e, 'UPDATE', 'reservations', updatedData, id));
      },
      deleteReservation: (id) => {
        set((state) => ({ reservations: state.reservations.filter(res => res.id !== id) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('reservations').delete().eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'DELETE', 'reservations', null, id))
          .catch(e => get().handleMutationResponse(e, 'DELETE', 'reservations', null, id));
      },
      // CARS
      cars: [
        { id: 'c1', name: 'Suzuki Jimny', plate: 'AB-CD-12', dailyRate: 45000, color: '#27ae60', isActive: true, promoThresholdDays: 3, promoDailyRate: 40000 },
        { id: 'c2', name: 'Nissan X-Trail', plate: 'XY-ZA-99', dailyRate: 65000, color: '#2980b9', isActive: true, promoThresholdDays: 0, promoDailyRate: 0 }
      ],
      addCar: (car) => {
        const newCar = { ...car, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ cars: [...state.cars, newCar] }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('cars').insert([newCar])
          .then(({error}) => get().handleMutationResponse(error, 'INSERT', 'cars', newCar))
          .catch(e => get().handleMutationResponse(e, 'INSERT', 'cars', newCar));
      },
      updateCar: (id, updatedData) => {
        set((state) => ({ cars: state.cars.map(c => c.id === id ? { ...c, ...updatedData } : c) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('cars').update(updatedData).eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'UPDATE', 'cars', updatedData, id))
          .catch(e => get().handleMutationResponse(e, 'UPDATE', 'cars', updatedData, id));
      },
      deleteCar: (id) => {
        set((state) => ({ cars: state.cars.filter(c => c.id !== id) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('cars').delete().eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'DELETE', 'cars', null, id))
          .catch(e => get().handleMutationResponse(e, 'DELETE', 'cars', null, id));
      },

      // CAR RESERVATIONS
      carReservations: [],
      addCarReservation: (res) => {
        const newRes = { ...res, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ carReservations: [...state.carReservations, newRes] }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('car_reservations').insert([newRes])
          .then(({error}) => get().handleMutationResponse(error, 'INSERT', 'car_reservations', newRes))
          .catch(e => get().handleMutationResponse(e, 'INSERT', 'car_reservations', newRes));
      },
      updateCarReservation: (id, updatedData) => {
        set((state) => ({ carReservations: state.carReservations.map(r => r.id === id ? { ...r, ...updatedData } : r) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('car_reservations').update(updatedData).eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'UPDATE', 'car_reservations', updatedData, id))
          .catch(e => get().handleMutationResponse(e, 'UPDATE', 'car_reservations', updatedData, id));
      },
      deleteCarReservation: (id) => {
        set((state) => ({ carReservations: state.carReservations.filter(r => r.id !== id) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('car_reservations').delete().eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'DELETE', 'car_reservations', null, id))
          .catch(e => get().handleMutationResponse(e, 'DELETE', 'car_reservations', null, id));
      },
      // TOURS
      tours: [
        { id: 't1', name: 'Tour Rapa Nui Completo', description: 'Recorrido histórico y cultural por los sitios sagrados', price: 65000, duration: '1 Día completo', maxCapacity: 12, color: '#8e44ad', isActive: true },
        { id: 't2', name: 'Tour Snorkel & Submarino', description: 'Exploración marina y arrecifes de coral en aguas cristalinas', price: 45000, duration: '3 Horas', maxCapacity: 8, color: '#16a085', isActive: true },
        { id: 't3', name: 'Tour Trekking Atardecer', description: 'Caminata guiada al volcán y mirador panorámico', price: 35000, duration: '4 Horas', maxCapacity: 15, color: '#e67e22', isActive: true }
      ],
      addTour: (tour) => {
        const newTour = { ...tour, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ tours: [...state.tours, newTour] }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('tours').insert([newTour])
          .then(({error}) => get().handleMutationResponse(error, 'INSERT', 'tours', newTour))
          .catch(e => get().handleMutationResponse(e, 'INSERT', 'tours', newTour));
      },
      updateTour: (id, updatedData) => {
        set((state) => ({ tours: state.tours.map(t => t.id === id ? { ...t, ...updatedData } : t) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('tours').update(updatedData).eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'UPDATE', 'tours', updatedData, id))
          .catch(e => get().handleMutationResponse(e, 'UPDATE', 'tours', updatedData, id));
      },
      deleteTour: (id) => {
        set((state) => ({ tours: state.tours.filter(t => t.id !== id) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('tours').delete().eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'DELETE', 'tours', null, id))
          .catch(e => get().handleMutationResponse(e, 'DELETE', 'tours', null, id));
      },

      // TOUR RESERVATIONS
      tourReservations: [],
      addTourReservation: (res) => {
        const newRes = { ...res, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ tourReservations: [...state.tourReservations, newRes] }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('tour_reservations').insert([newRes])
          .then(({error}) => get().handleMutationResponse(error, 'INSERT', 'tour_reservations', newRes))
          .catch(e => get().handleMutationResponse(e, 'INSERT', 'tour_reservations', newRes));
      },
      updateTourReservation: (id, updatedData) => {
        set((state) => ({ tourReservations: state.tourReservations.map(r => r.id === id ? { ...r, ...updatedData } : r) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('tour_reservations').update(updatedData).eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'UPDATE', 'tour_reservations', updatedData, id))
          .catch(e => get().handleMutationResponse(e, 'UPDATE', 'tour_reservations', updatedData, id));
      },
      deleteTourReservation: (id) => {
        set((state) => ({ tourReservations: state.tourReservations.filter(r => r.id !== id) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('tour_reservations').delete().eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'DELETE', 'tour_reservations', null, id))
          .catch(e => get().handleMutationResponse(e, 'DELETE', 'tour_reservations', null, id));
      },

      // REFERRERS (Agencias/Clientes)
      referrers: [],
      addReferrer: (referrer) => {
        const newRef = { ...referrer, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
        set((state) => ({ referrers: [...state.referrers, newRef] }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('referrers').insert([newRef])
          .then(({error}) => get().handleMutationResponse(error, 'INSERT', 'referrers', newRef))
          .catch(e => get().handleMutationResponse(e, 'INSERT', 'referrers', newRef));
        
        return newRef.id;
      },
      updateReferrer: (id, updatedData) => {
        set((state) => ({ referrers: state.referrers.map(r => r.id === id ? { ...r, ...updatedData } : r) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('referrers').update(updatedData).eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'UPDATE', 'referrers', updatedData, id))
          .catch(e => get().handleMutationResponse(e, 'UPDATE', 'referrers', updatedData, id));
      },
      deleteReferrer: (id) => {
        set((state) => ({ referrers: state.referrers.filter(r => r.id !== id) }));
        
        const sb = getSupabase(get().syncConfig);
        if (sb) sb.from('referrers').delete().eq('id', id)
          .then(({error}) => get().handleMutationResponse(error, 'DELETE', 'referrers', null, id))
          .catch(e => get().handleMutationResponse(e, 'DELETE', 'referrers', null, id));
      },

      // Sync Configurations
      syncConfig: {
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
        supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        googleClientId: ''
      },
      updateSyncConfig: (newConfig) => set((state) => ({
        syncConfig: { ...state.syncConfig, ...newConfig }
      })),

      // Auth State
      user: null,
      session: null,
      authError: null,
      isAuthChecking: true,

      login: async (email, password) => {
        const sb = getSupabase(get().syncConfig);
        if (!sb) {
          set({ authError: 'No hay conexión a la base de datos' });
          return false;
        }
        
        try {
          const { data, error } = await sb.auth.signInWithPassword({ email, password });
          if (error) {
            set({ authError: error.message });
            return false;
          }
          set({ user: data.user, session: data.session, authError: null });
          return true;
        } catch (err) {
          set({ authError: err.message });
          return false;
        }
      },

      logout: async () => {
        const sb = getSupabase(get().syncConfig);
        if (sb) {
          await sb.auth.signOut();
        }
        set({ user: null, session: null });
      },

      checkSession: async () => {
        const sb = getSupabase(get().syncConfig);
        if (!sb) {
          set({ isAuthChecking: false });
          return;
        }

        const { data: { session } } = await sb.auth.getSession();
        set({ session, user: session?.user || null, isAuthChecking: false });

        // Listen for auth changes
        sb.auth.onAuthStateChange((_event, session) => {
          set({ session, user: session?.user || null });
        });
      },

      // Pull from Supabase
      fetchFromSupabase: async () => {
        const sb = getSupabase(get().syncConfig);
        if (!sb) return;
        
        console.log("Iniciando sincronización con Supabase...");
        
        const { data: cabinsData, error: cabinsError } = await sb.from('cabins').select('*');
        if (cabinsError) {
          console.error("Error al obtener cabañas:", cabinsError);
        } else if (cabinsData) {
          set({ cabins: cabinsData });
        }
        
        const { data: resData, error: resError } = await sb.from('reservations').select('*');
        if (resError) {
          console.error("Error al obtener reservas:", resError);
        } else if (resData) {
          set({ reservations: resData });
        }

        // Fetch Cars
        const { data: carsData, error: carsError } = await sb.from('cars').select('*');
        if (carsError) console.error("Error cars:", carsError);
        else if (carsData) {
          set({ cars: carsData });
        }

        // Fetch Car Reservations
        const { data: carResData, error: carResError } = await sb.from('car_reservations').select('*');
        if (carResError) console.error("Error car reservations:", carResError);
        else if (carResData) {
          set({ carReservations: carResData });
        }

        // Fetch Tours
        const { data: toursData, error: toursError } = await sb.from('tours').select('*');
        if (toursError) console.error("Error tours:", toursError);
        else if (toursData) {
          set({ tours: toursData });
        }

        // Fetch Tour Reservations
        const { data: tourResData, error: tourResError } = await sb.from('tour_reservations').select('*');
        if (tourResError) console.error("Error tour reservations:", tourResError);
        else if (tourResData) {
          set({ tourReservations: tourResData });
        }

        // Fetch Referrers
        const { data: refData, error: refError } = await sb.from('referrers').select('*');
        if (refError) console.error("Error referrers:", refError);
        else if (refData) {
          set({ referrers: refData });
        }
      },

      // Realtime Sync
      initRealtimeSubscription: () => {
        const sb = getSupabase(get().syncConfig);
        if (!sb) return;

        console.log("Iniciando suscripciones en tiempo real...");

        const handleRealtimeEvent = (table, stateKey) => (payload) => {
          console.log(`Evento Realtime en ${table}:`, payload);
          set((state) => {
            const currentList = state[stateKey];
            let newList = [...currentList];

            if (payload.eventType === 'INSERT') {
              // Evitar duplicados
              if (!newList.find(item => item.id === payload.new.id)) {
                newList.push(payload.new);
              }
            } else if (payload.eventType === 'UPDATE') {
              newList = newList.map(item => item.id === payload.new.id ? { ...item, ...payload.new } : item);
            } else if (payload.eventType === 'DELETE') {
              newList = newList.filter(item => item.id !== payload.old.id);
            }

            return { [stateKey]: newList };
          });
        };

        const channel = sb.channel('public:all')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, handleRealtimeEvent('reservations', 'reservations'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'cabins' }, handleRealtimeEvent('cabins', 'cabins'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'cars' }, handleRealtimeEvent('cars', 'cars'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'car_reservations' }, handleRealtimeEvent('car_reservations', 'carReservations'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tours' }, handleRealtimeEvent('tours', 'tours'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tour_reservations' }, handleRealtimeEvent('tour_reservations', 'tourReservations'))
                    .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Conectado a Supabase Realtime');
            }
          });
        
        return () => {
          sb.removeChannel(channel);
        };
      }
    }),
    {
      name: 'cabin-storage',
    }
  )
);
