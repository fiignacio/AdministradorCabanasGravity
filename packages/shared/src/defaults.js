export const DEFAULT_BUSINESS_CONFIG = {
  businessName: 'Cabañas Manuara',
  administratorName: 'Administrador Principal',
  primaryColor: '#8C5A32',
  contactPhone: '+56 9 8456 2244',
  contactEmail: 'cabanasmanuara@gmail.com',
  logoUrl: '/images/logo_manuara.png',
  isSetupCompleted: true
};

export const DEFAULT_PRICES = {
  highSeasonAdult: 35000,
  lowSeasonAdult: 30000,
  child: 15000
};

export const DEFAULT_SEASON_CONFIG = {
  highSeasonMonths: [11, 0, 1, 2, 3], // 11=Dic, 0=Ene, 1=Feb, 2=Mar, 3=Abr
  highSeasonName: 'Temporada Alta',
  lowSeasonName: 'Temporada Baja'
};

export const DEFAULT_DISCOUNT_CONFIG = {
  enableGroupDiscount: true,
  groupMinGuests: 10,
  groupRatePerAdult: 25000,
  enableDurationDiscount: false,
  durationMinNights: 7,
  durationDiscountPercent: 10
};

export const DEFAULT_CABINS = [
  { id: '1', name: 'Cabaña Grande', type: 'large', maxCapacity: 6, color: '#D35400', owner: 'Dueño 1' },
  { id: '2', name: 'Cabaña Pequeña', type: 'small', maxCapacity: 3, color: '#556B2F', owner: 'Dueño 1' },
  { id: '3', name: 'Cabaña Mediana 1', type: 'medium', maxCapacity: 4, color: '#B8860B', owner: 'Dueño 2' },
  { id: '4', name: 'Cabaña Mediana 2', type: 'medium', maxCapacity: 4, color: '#CD853F', owner: 'Dueño 2' }
];

export const DEFAULT_CARS = [
  { id: 'c1', name: 'Suzuki Jimny', plate: 'AB-CD-12', dailyRate: 45000, color: '#27ae60', isActive: true, promoThresholdDays: 3, promoDailyRate: 40000 },
  { id: 'c2', name: 'Nissan X-Trail', plate: 'XY-ZA-99', dailyRate: 65000, color: '#2980b9', isActive: true, promoThresholdDays: 0, promoDailyRate: 0 }
];

export const DEFAULT_TOURS = [
  { id: 't1', name: 'Tour Rapa Nui Completo', description: 'Recorrido histórico y cultural por los sitios sagrados', price: 65000, duration: '1 Día completo', maxCapacity: 12, color: '#8e44ad', isActive: true },
  { id: 't2', name: 'Tour Snorkel & Submarino', description: 'Exploración marina y arrecifes de coral en aguas cristalinas', price: 45000, duration: '3 Horas', maxCapacity: 8, color: '#16a085', isActive: true },
  { id: 't3', name: 'Tour Trekking Atardecer', description: 'Caminata guiada al volcán y mirador panorámico', price: 35000, duration: '4 Horas', maxCapacity: 15, color: '#e67e22', isActive: true }
];
