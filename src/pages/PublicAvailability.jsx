import { useState, useMemo } from 'react';
import { 
  Calendar, Users, Car, CheckCircle2, AlertCircle, 
  Send, Home, ShieldCheck, Check, Share2, Sparkles, Moon, Info, X, Clock, FileCheck, Phone, Mail, MessageSquare
} from 'lucide-react';
import { format, differenceInDays, addDays, parseISO } from 'date-fns';
import { useStore, getSupabase } from '../store/useStore';
import { generateWhatsAppLink, generatePublicRequestMessage } from '../utils/whatsapp';
import './PublicAvailability.css';

export default function PublicAvailability() {
  const { businessConfig, cabins, cars, prices, reservations, carReservations, syncConfig, addReservation, addCarReservation } = useStore();

  const today = format(new Date(), 'yyyy-MM-dd');
  const twoDaysLater = format(addDays(new Date(), 2), 'yyyy-MM-dd');

  // Fechas de Cabaña / Estadía
  const [startDateStr, setStartDateStr] = useState(today);
  const [endDateStr, setEndDateStr] = useState(twoDaysLater);
  
  // Pasajeros
  const [adults, setAdults] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [babiesCount, setBabiesCount] = useState(0);

  // Selección de Cabaña y Vehículo
  const [selectedCabinId, setSelectedCabinId] = useState('all');
  const [selectedCarId, setSelectedCarId] = useState('none');

  // Modo de arriendo de vehículo ('stay' = Total de la estadía, 'custom' = Fechas específicas)
  const [carRentalMode, setCarRentalMode] = useState('stay');
  const [carStartDateStr, setCarStartDateStr] = useState(today);
  const [carEndDateStr, setCarEndDateStr] = useState(twoDaysLater);

  const [clientName, setClientName] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Estado Modal de Solicitud de Pre-Reserva
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reqClientPhone, setReqClientPhone] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [requestSuccess, setRequestSuccess] = useState(false);

  // Fechas parseadas de Estadía
  const sDate = parseISO(startDateStr);
  const eDate = parseISO(endDateStr);
  const nights = Math.max(1, differenceInDays(eDate, sDate) || 1);
  const totalGuests = adults + childrenCount + babiesCount;

  // Fechas parseadas de Vehículo
  const carSDate = carRentalMode === 'stay' ? sDate : parseISO(carStartDateStr);
  const carEDate = carRentalMode === 'stay' ? eDate : parseISO(carEndDateStr);
  const carEffectiveStartStr = carRentalMode === 'stay' ? startDateStr : carStartDateStr;
  const carEffectiveEndStr = carRentalMode === 'stay' ? endDateStr : carEndDateStr;
  const carDays = Math.max(1, differenceInDays(carEDate, carSDate) || 1);

  // Determinar temporada (Alta: Dic, Ene, Feb, Mar)
  const isHighSeason = useMemo(() => {
    if (!startDateStr) return false;
    const month = sDate.getMonth();
    return month === 11 || month === 0 || month === 1 || month === 2;
  }, [startDateStr, sDate]);

  // Verificar disponibilidad de una cabaña específica
  const isCabinAvailable = (cabinId) => {
    return !reservations.some(res => {
      if (res.cabinId !== cabinId && res.cabinId !== String(cabinId)) return false;
      return res.startDate < endDateStr && res.endDate > startDateStr;
    });
  };

  // Verificar disponibilidad de un vehículo en las fechas efectivas de arriendo
  const isCarAvailable = (carId, cStart = carEffectiveStartStr, cEnd = carEffectiveEndStr) => {
    if (carId === 'none') return true;
    return !carReservations?.some(res => {
      if (res.carId !== carId && res.carId !== String(carId)) return false;
      return res.startDate < cEnd && res.endDate > cStart;
    });
  };

  // Cabañas disponibles filtradas
  const availableCabins = useMemo(() => {
    return cabins.filter(c => isCabinAvailable(c.id));
  }, [cabins, reservations, startDateStr, endDateStr]);

  // Cabaña seleccionada activa
  const activeCabin = useMemo(() => {
    if (selectedCabinId === 'all') {
      return availableCabins.find(c => c.maxCapacity >= totalGuests) || availableCabins[0] || null;
    }
    return cabins.find(c => String(c.id) === String(selectedCabinId)) || null;
  }, [selectedCabinId, availableCabins, cabins, totalGuests]);

  const activeCabinIsAvailable = activeCabin ? isCabinAvailable(activeCabin.id) : false;

  // Precios y cotización de Cabaña
  const cabinPricePerNight = useMemo(() => {
    let ratePerAdult = isHighSeason ? prices.highSeasonAdult : prices.lowSeasonAdult;
    if (totalGuests >= 10) ratePerAdult = 25000;
    const totalAdultsCost = adults * ratePerAdult;
    const totalChildrenCost = childrenCount * prices.child;
    return totalAdultsCost + totalChildrenCost;
  }, [isHighSeason, prices, adults, childrenCount, totalGuests]);

  const cabinTotalCost = cabinPricePerNight * nights;

  // Cotización de Vehículo
  const activeCar = useMemo(() => {
    return cars.find(c => String(c.id) === String(selectedCarId)) || null;
  }, [selectedCarId, cars]);

  const activeCarIsAvailable = activeCar ? isCarAvailable(activeCar.id, carEffectiveStartStr, carEffectiveEndStr) : true;

  const carTotalCost = useMemo(() => {
    if (!activeCar) return 0;
    const rate = (activeCar.promoThresholdDays > 0 && carDays >= activeCar.promoThresholdDays && activeCar.promoDailyRate > 0)
      ? activeCar.promoDailyRate
      : activeCar.dailyRate;
    return rate * carDays;
  }, [activeCar, carDays]);

  const grandTotal = cabinTotalCost + carTotalCost;
  const deposit50 = Math.round(grandTotal * 0.5);

  // Copiar Enlace
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Enviar Notificación Interna al Admin
  const sendAdminNotification = async (msg) => {
    try {
      const sb = getSupabase(syncConfig);
      if (sb) {
        await sb.from('admin_notifications').insert([{
          type: 'quote_inquiry',
          title: 'Nueva Consulta desde la Web Pública',
          message: msg,
          read: false,
          created_at: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.warn("No se pudo registrar la notificación interna:", err);
    }
  };

  // Abrir Modal de Solicitud de Pre-Reserva
  const handleOpenRequestModal = () => {
    setRequestSuccess(false);
    setIsRequestModalOpen(true);
  };

  // Enviar y Registrar Solicitud de Reserva (Estado PENDIENTE)
  const handleConfirmRequest = (e) => {
    e.preventDefault();
    if (!clientName.trim() || !reqClientPhone.trim()) {
      alert("Por favor ingresa tu nombre y teléfono/WhatsApp de contacto.");
      return;
    }

    // 1. Guardar Reserva de Cabaña con estado 'pending' (Aprobación manual requerida)
    let newResId = null;
    if (activeCabin) {
      newResId = addReservation({
        cabinId: activeCabin.id,
        clientName: clientName.trim(),
        clientPhone: reqClientPhone.trim(),
        startDate: startDateStr,
        endDate: endDateStr,
        adults: Number(adults),
        childrenCount: Number(childrenCount),
        babiesCount: Number(babiesCount),
        totalCost: grandTotal,
        depositAmount: deposit50,
        paymentMethod: 'Por Confirmar',
        status: 'pending', // ⚠️ Queda en estado PENDIENTE de revisión por Admin
        notes: `Solicitud Web Pública | Email: ${reqEmail || 'N/I'} | Notas: ${reqNotes || 'Sin notas'}`
      });
    }

    // 2. Guardar Reserva de Vehículo con estado 'pending' (si aplica)
    if (activeCar && selectedCarId !== 'none') {
      addCarReservation({
        carId: activeCar.id,
        clientName: clientName.trim(),
        clientPhone: reqClientPhone.trim(),
        startDate: carEffectiveStartStr,
        endDate: carEffectiveEndStr,
        totalCost: carTotalCost,
        depositAmount: Math.round(carTotalCost * 0.5),
        paymentMethod: 'Por Confirmar',
        status: 'pending',
        linkedCabinReservationId: newResId || null,
        notes: `Solicitud Web Pública | Email: ${reqEmail || 'N/I'}`
      });
    }

    // 3. Registrar Notificación Interna y lanzar alerta sonora/vibración para el Administrador
    const summaryNotif = `🔔 SOLICITUD PENDIENTE: ${clientName.trim()} solicita ${activeCabin ? activeCabin.name : 'Alojamiento'} (${nights} noches, ${totalGuests} pax) ${activeCar ? '+ ' + activeCar.name : ''} por $${grandTotal.toLocaleString('es-CL')}.`;
    sendAdminNotification(summaryNotif);

    import('../utils/notifications').then(({ sendNativeNotification }) => {
      sendNativeNotification('🔔 Nueva Solicitud de Reserva', `${clientName.trim()} ha enviado una solicitud para ${activeCabin ? activeCabin.name : 'Cabaña'}.`);
    });

    // 4. Generar y Abrir Enlace de WhatsApp para el Administrador
    const bPhone = businessConfig.contactPhone?.replace(/\D/g, '') || '56984562244';
    const bName = businessConfig.businessName || 'Cabañas Manuara';

    const waMsg = generatePublicRequestMessage({
      clientName: clientName.trim(),
      clientPhone: reqClientPhone.trim(),
      cabinName: activeCabin ? activeCabin.name : 'Alojamiento',
      startDate: format(sDate, 'dd/MM/yyyy'),
      endDate: format(eDate, 'dd/MM/yyyy'),
      nights,
      adults,
      childrenCount,
      babiesCount,
      carName: activeCar ? activeCar.name : null,
      carDays,
      grandTotal,
      deposit50,
      notes: reqNotes,
      businessName: bName
    });

    const waUrl = generateWhatsAppLink(bPhone, waMsg);
    if (waUrl) {
      window.open(waUrl, '_blank');
    }

    setRequestSuccess(true);
  };

  return (
    <div className="public-portal-container" id="inicio">
      {/* NAVBAR DE NAVEGACIÓN PRINCIPAL */}
      <header className="public-header glass-panel">
        <div className="public-header-brand">
          <img src="/images/logo_manuara.png" alt="Cabañas Manuara Logo" className="public-brand-logo" />
          <div>
            <h1 className="public-brand-title">Cabañas Manuara</h1>
            <p className="public-brand-subtitle">Alojamiento & Rent a Car en Rapa Nui</p>
          </div>
        </div>

        <nav className="public-nav-menu">
          <a href="#inicio" className="nav-link">Inicio</a>
          <a href="#cabanas" className="nav-link">Cabañas</a>
          <a href="#servicios" className="nav-link">Vehículos & Tours</a>
          <a href="#ubicacion" className="nav-link">Ubicación</a>
          <a href="#cotizador" className="nav-link btn-nav-highlight">Cotizar Disponibilidad</a>
          <a href="#contacto" className="nav-link">Contacto</a>
        </nav>

        <div className="public-header-actions">
          <button className="btn-share-link" onClick={handleCopyLink} title="Copiar enlace de esta página">
            {copiedLink ? <Check size={16} color="var(--success)" /> : <Share2 size={16} />}
            <span>{copiedLink ? '¡Copiado!' : 'Compartir'}</span>
          </button>
        </div>
      </header>

      {/* HERO SECTION DE BIENVENIDA */}
      <section className="hero-section glass-panel">
        <div className="hero-overlay"></div>
        <img src="/images/hero.jpg" alt="Cabañas Manuara en Rapa Nui" className="hero-bg-img" />
        
        <div className="hero-content">
          <div className="hero-logo-badge">
            <img src="/images/logo_manuara.png" alt="Logo Cabañas Manuara" className="hero-badge-logo" />
            <span className="hero-badge">🗿 Isla de Pascua • Rapa Nui</span>
          </div>

          <h2 className="hero-title">Cabañas Manuara</h2>
          <p className="hero-subtitle">
            Disfruta de cabañas independientes totalmente equipadas, arriendo de vehículos para explorar la isla y traslados gratuitos desde el Aeropuerto Mataveri con el tradicional collar de flores de bienvenida.
          </p>

          <div className="hero-features-grid">
            <div className="hero-feature-pill">
              <Sparkles size={16} color="#eab308" />
              <span>Traslado Aeropuerto Incluido</span>
            </div>
            <div className="hero-feature-pill">
              <Home size={16} color="#3b82f6" />
              <span>Cocina Equipada & WiFi</span>
            </div>
            <div className="hero-feature-pill">
              <Car size={16} color="#22c55e" />
              <span>Arriendo de Vehículos</span>
            </div>
            <div className="hero-feature-pill">
              <ShieldCheck size={16} color="#a855f7" />
              <span>Atención Personalizada</span>
            </div>
          </div>

          <div className="hero-actions">
            <a href="#cotizador" className="btn-hero-primary">
              <Calendar size={18} /> Consultar Disponibilidad
            </a>
            <a href="#cabanas" className="btn-hero-secondary">
              <Home size={18} /> Ver Cabañas
            </a>
          </div>
        </div>
      </section>

      {/* SECCIÓN 1: ¿POR QUÉ ELEGIR CABAÑAS MANUARA? (INFORMACIÓN DE VALOR) */}
      <section className="public-section">
        <div className="section-header-box">
          <span className="section-subtitle">Tu Experiencia en Rapa Nui</span>
          <h2 className="section-title">¿Por qué elegir Cabañas Manuara?</h2>
          <p className="section-desc">
            Nos dedicamos a brindarte una estadía inolvidable con la auténtica hospitalidad pascuense y servicios integrales para tu comodidad.
          </p>
        </div>

        <div className="features-info-grid">
          <div className="info-card glass-panel">
            <div className="info-card-icon">🌸</div>
            <h3>Bienvenida Rapa Nui</h3>
            <p>
              Te recibimos en el Aeropuerto Mataveri con el tradicional collar de flores y te trasladamos sin costo directo a tu cabaña.
            </p>
          </div>

          <div className="info-card glass-panel">
            <div className="info-card-icon">🌴</div>
            <h3>Entorno Tranquilo & Céntrico</h3>
            <p>
              Ubicados en un entorno natural pacífico en Hanga Roa, a pocos minutos de restaurantes, artesanías y la costa.
            </p>
          </div>

          <div className="info-card glass-panel">
            <div className="info-card-icon">🏡</div>
            <h3>Cabañas 100% Equipadas</h3>
            <p>
              Cocinas completas, terraza privada con vista al jardín, estacionamiento, agua caliente continua y conexión WiFi.
            </p>
          </div>

          <div className="info-card glass-panel">
            <div className="info-card-icon">🚗</div>
            <h3>Arriendo de Vehículos & Tours</h3>
            <p>
              Arriendo de vehículos y excursiones guiadas con guías locales acreditados para conocer toda la isla sin preocupaciones.
            </p>
          </div>
        </div>
      </section>

      {/* SECCIÓN 2: NUESTRAS CABAÑAS */}
      <section id="cabanas" className="public-section">
        <div className="section-header-box">
          <span className="section-subtitle">Alojamientos Confortables</span>
          <h2 className="section-title">Nuestras Cabañas en Rapa Nui</h2>
          <p className="section-desc">
            Espacios independientes diseñados para el descanso de parejas, familias y grupos en Isla de Pascua.
          </p>
        </div>

        <div className="cabins-showcase-grid">
          {cabins && cabins.map(c => (
            <div key={c.id} className="cabin-showcase-card glass-panel">
              <div className="cabin-card-header">
                <div className="cabin-icon-wrapper">
                  <Home size={28} color="#8C5A32" />
                </div>
                <div className="cabin-badge-cap">
                  <Users size={15} /> Hasta {c.maxCapacity} Huéspedes
                </div>
              </div>
              <h3 className="cabin-card-name">{c.name}</h3>
              <p className="cabin-card-desc">
                Cabaña independiente en entorno natural con terraza privada, estacionamiento y todas las comodidades para tu estadía en Rapa Nui.
              </p>
              
              <ul className="cabin-amenities-list">
                <li><Check size={14} color="#22c55e" /> Cocina totalmente equipada</li>
                <li><Check size={14} color="#22c55e" /> Baño privado con agua caliente</li>
                <li><Check size={14} color="#22c55e" /> Traslado Aeropuerto Mataveri (Ida/Vuelta)</li>
                <li><Check size={14} color="#22c55e" /> Conexión WiFi & Estacionamiento</li>
              </ul>

              <div className="cabin-card-footer">
                <a 
                  href="#cotizador" 
                  className="btn-select-cabin"
                  onClick={() => setSelectedCabinId(String(c.id))}
                >
                  Seleccionar esta Cabaña
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECCIÓN 3: VEHÍCULOS Y TOURS */}
      <section id="servicios" className="public-section bg-section-alt glass-panel">
        <div className="section-header-box">
          <span className="section-subtitle">Servicios Adicionales</span>
          <h2 className="section-title">Arriendo de Vehículos & Tours Arqueológicos</h2>
          <p className="section-desc">
            Complementa tu estadía en Cabañas Manuara explorando la isla a tu propio ritmo o acompañado de nuestros guías locales.
          </p>
        </div>

        <div className="services-grid">
          <div className="service-card">
            <div className="service-icon"><Car size={32} color="#3b82f6" /></div>
            <h3>Arriendo de Vehículos</h3>
            <p>
              Contamos con vehículos acondicionados para el terreno de Rapa Nui. Entrega directa en tus cabañas o en el aeropuerto.
            </p>
            <span className="service-tag">Jeeps & SUVs • Entrega Inmediata</span>
          </div>

          <div className="service-card">
            <div className="service-icon"><Sparkles size={32} color="#eab308" /></div>
            <h3>Tours Arqueológicos Guiados</h3>
            <p>
              Descubre Ahu Tongariki, la cantera de moais de Rano Raraku, la aldea ceremonial de Orongo y la paradisíaca playa de Anakena.
            </p>
            <span className="service-tag">Guías Locales • Experiencia Única</span>
          </div>

          <div className="service-card">
            <div className="service-icon"><ShieldCheck size={32} color="#22c55e" /></div>
            <h3>Bienvenida Rapa Nui</h3>
            <p>
              Te esperamos en el Aeropuerto Mataveri con el tradicional collar de flores y te trasladamos de forma gratuita a tu cabaña.
            </p>
            <span className="service-tag">Incluido en tu Reserva</span>
          </div>
        </div>
      </section>

      {/* SECCIÓN 4: NUESTRA UBICACIÓN & MAPA INTERACTIVO */}
      <section id="ubicacion" className="public-section">
        <div className="section-header-box">
          <span className="section-subtitle">Encuéntranos en Hanga Roa</span>
          <h2 className="section-title">Nuestra Ubicación</h2>
          <p className="section-desc">
            Estratégicamente ubicados para tu comodidad y acceso a los principales atractivos
          </p>
        </div>

        <div className="location-map-container glass-panel">
          <div className="map-top-bar">
            <a 
              href="https://www.google.com/maps/search/?api=1&query=Caba%C3%B1as+Manuara+Hanga+Roa+Rapa+Nui" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-open-maps"
            >
              Abrir en Maps ↗
            </a>
          </div>

          <div className="map-iframe-wrapper">
            <iframe
              title="Mapa de Ubicación de Cabañas Manuara en Rapa Nui"
              src="https://maps.google.com/maps?q=Caba%C3%B1as%20Manuara%2C%20Avareipua%2C%20Hanga%20Roa%2C%20Isla%20de%20Pascua&t=&z=16&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="450"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>

          <div className="location-benefits-grid">
            <div className="loc-benefit-item">
              <span className="benefit-icon">✈️</span>
              <div>
                <strong>Aeropuerto Mataveri</strong>
                <p>A solo 3 minutos en vehículo (traslado gratuito incluido).</p>
              </div>
            </div>
            
            <div className="loc-benefit-item">
              <span className="benefit-icon">🌊</span>
              <div>
                <strong>Caleta Hanga Piko</strong>
                <p>A pocos minutos a pie para contemplar la costa y actividades náuticas.</p>
              </div>
            </div>

            <div className="loc-benefit-item">
              <span className="benefit-icon">🛍️</span>
              <div>
                <strong>Centro de Hanga Roa</strong>
                <p>Cercano a restaurantes, feria artesanal y supermercados.</p>
              </div>
            </div>
          </div>

          <div className="map-bottom-cta">
            <a 
              href="https://www.google.com/maps/search/?api=1&query=Caba%C3%B1as+Manuara+Hanga+Roa+Rapa+Nui" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-google-maps-full"
            >
              Abrir en Google Maps
            </a>
          </div>
        </div>
      </section>

      {/* SECCIÓN 5: PREGUNTAS FRECUENTES (INFORMACIÓN ÚTIL PARA EL TURISTA) */}
      <section className="public-section">
        <div className="section-header-box">
          <span className="section-subtitle">Información Útil</span>
          <h2 className="section-title">Preguntas Frecuentes de nuestros Huéspedes</h2>
          <p className="section-desc">
            Resolvemos las dudas más comunes sobre tu viaje a Rapa Nui y la estadía en Cabañas Manuara.
          </p>
        </div>

        <div className="faq-grid">
          <div className="faq-card glass-panel">
            <h4>✈️ ¿El traslado desde el aeropuerto está incluido?</h4>
            <p>
              ¡Sí! Te esperamos en el Aeropuerto Mataveri con el tradicional collar de flores de bienvenida y te trasladamos a las cabañas sin costo adicional, tanto a la llegada como a tu regreso.
            </p>
          </div>

          <div className="faq-card glass-panel">
            <h4>🕐 ¿Cuáles son las horas de Check-In y Check-Out?</h4>
            <p>
              El Check-In estándar es a partir de las 14:00 hrs y el Check-Out hasta las 11:00 hrs. Coordinamos con la llegada de tu vuelo LATAM para brindarte la mayor comodidad posible.
            </p>
          </div>

          <div className="faq-card glass-panel">
            <h4>📄 ¿Qué documentos se necesitan para viajar a Rapa Nui?</h4>
            <p>
              Debes contar con tu cédula o pasaporte vigente, el formulario FUI del Ministerio del Interior y la reserva de alojamiento confirmada (que te enviamos al concretar tu reserva).
            </p>
          </div>

          <div className="faq-card glass-panel">
            <h4>💳 ¿Cómo se realiza la confirmación de reserva?</h4>
            <p>
              Una vez enviada tu solicitud, la administración revisa la disponibilidad y se contacta contigo por WhatsApp para coordinar el abono del 50% vía transferencia o tarjeta.
            </p>
          </div>
        </div>
      </section>

      {/* SECCIÓN 6: COTIZADOR & BUSCADOR DE DISPONIBILIDAD (AL FINAL DE TODAS LAS SECCIONES) */}
      <section id="cotizador" className="public-section cotizador-final-section">
        <div className="section-header-box">
          <span className="section-subtitle">Reserva Tu Estadía</span>
          <h2 className="section-title">Consulta de Disponibilidad & Cotizador</h2>
          <p className="section-desc">
            Selecciona tus fechas de viaje y obtén tu cotización en tiempo real para vivir la experiencia Rapa Nui en Cabañas Manuara.
          </p>
        </div>

        <main className="public-content-grid elegant-booking-engine">
          {/* PANEL IZQUIERDO: SELECCIÓN Y FORMULARIO */}
          <section className="public-card glass-panel booking-form-card">
            <h2 className="public-card-title">
              <Calendar size={22} color="#8C5A32" /> 1. Fechas de Estadía y Pasajeros
            </h2>

            <div className="public-form-grid">
              <div className="public-form-group">
                <label className="public-label">Fecha de Check-In (Llegada)</label>
                <input 
                  type="date" 
                  className="public-input" 
                  value={startDateStr}
                  min={today}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setStartDateStr(newStart);
                    if (newStart >= endDateStr) {
                      const newEnd = format(addDays(parseISO(newStart), 1), 'yyyy-MM-dd');
                      setEndDateStr(newEnd);
                      if (carRentalMode === 'stay') {
                        setCarStartDateStr(newStart);
                        setCarEndDateStr(newEnd);
                      }
                    } else if (carRentalMode === 'stay') {
                      setCarStartDateStr(newStart);
                    }
                  }}
                />
              </div>

              <div className="public-form-group">
                <label className="public-label">Fecha de Check-Out (Salida)</label>
                <input 
                  type="date" 
                  className="public-input" 
                  value={endDateStr}
                  min={format(addDays(sDate, 1), 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const newEnd = e.target.value;
                    setEndDateStr(newEnd);
                    if (carRentalMode === 'stay') {
                      setCarEndDateStr(newEnd);
                    }
                  }}
                />
              </div>
            </div>

            <div className="nights-badge">
              <Moon size={16} /> <strong>{nights}</strong> {nights === 1 ? 'noche de estadía' : 'noches de estadía'} ({isHighSeason ? 'Temporada Alta' : 'Temporada Baja'})
            </div>

            <div className="public-form-group" style={{ marginTop: '1.2rem' }}>
              <label className="public-label"><Users size={18} /> Cantidad de Pasajeros</label>
              <div className="pax-counter-grid">
                <div className="pax-counter-box">
                  <span className="pax-type">Adultos</span>
                  <div className="counter-controls">
                    <button type="button" onClick={() => setAdults(Math.max(1, adults - 1))}>-</button>
                    <span>{adults}</span>
                    <button type="button" onClick={() => setAdults(adults + 1)}>+</button>
                  </div>
                </div>

                <div className="pax-counter-box">
                  <span className="pax-type">Niños</span>
                  <div className="counter-controls">
                    <button type="button" onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}>-</button>
                    <span>{childrenCount}</span>
                    <button type="button" onClick={() => setChildrenCount(childrenCount + 1)}>+</button>
                  </div>
                </div>

                <div className="pax-counter-box">
                  <span className="pax-type">Bebés</span>
                  <div className="counter-controls">
                    <button type="button" onClick={() => setBabiesCount(Math.max(0, babiesCount - 1))}>-</button>
                    <span>{babiesCount}</span>
                    <button type="button" onClick={() => setBabiesCount(babiesCount + 1)}>+</button>
                  </div>
                </div>
              </div>
            </div>

            <hr className="public-divider" />

            <h2 className="public-card-title">
              <Home size={22} color="#8C5A32" /> 2. Selección de Cabaña / Alojamiento
            </h2>

            <div className="public-form-group">
              <select 
                className="public-input" 
                value={selectedCabinId} 
                onChange={(e) => setSelectedCabinId(e.target.value)}
              >
                <option value="all">🌟 Seleccionar la mejor opción disponible automáticamente</option>
                {cabins.map(cabin => {
                  const avail = isCabinAvailable(cabin.id);
                  return (
                    <option key={cabin.id} value={cabin.id}>
                      {avail ? '✅ ' : '❌ [NO DISPONIBLE] '} {cabin.name} (Capacidad: {cabin.maxCapacity} pax)
                    </option>
                  );
                })}
              </select>
            </div>

            {activeCabin && (
              <div className={`availability-status-box ${activeCabinIsAvailable ? 'available' : 'unavailable'}`}>
                {activeCabinIsAvailable ? (
                  <>
                    <CheckCircle2 size={22} color="var(--success)" />
                    <div>
                      <strong>¡Disponible para tus fechas!</strong>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>{activeCabin.name} — Capacidad recomendada: {activeCabin.maxCapacity} personas.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle size={22} color="var(--danger)" />
                    <div>
                      <strong>No disponible para las fechas seleccionadas</strong>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>Por favor intenta seleccionar otro rango de fechas o prueba con otra cabaña.</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* OPCIONES ADICIONALES: VEHÍCULO */}
            <hr className="public-divider" />

            <h2 className="public-card-title">
              <Car size={22} color="#8C5A32" /> 3. Arriendo de Vehículo (Opcional)
            </h2>

            {cars && cars.length > 0 ? (
              <div className="public-form-group">
                <label className="public-label">Seleccionar Vehículo</label>
                <select 
                  className="public-input"
                  value={selectedCarId}
                  onChange={(e) => setSelectedCarId(e.target.value)}
                >
                  <option value="none">Sin arriendo de vehículo</option>
                  {cars.map(car => {
                    const avail = isCarAvailable(car.id, carEffectiveStartStr, carEffectiveEndStr);
                    return (
                      <option key={car.id} value={car.id} disabled={!avail}>
                        {avail ? '✅ ' : '❌ [NO DISPONIBLE EN FECHAS] '} {car.name} ({car.plate}) - ${car.dailyRate.toLocaleString('es-CL')}/día
                      </option>
                    );
                  })}
                </select>

                {/* SELECCIÓN DE PERÍODO DE ARRIENDO DE VEHÍCULO */}
                {selectedCarId !== 'none' && (
                  <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <label className="public-label" style={{ marginBottom: '0.6rem' }}>Período de Arriendo del Vehículo:</label>
                    
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input 
                          type="radio" 
                          name="carMode" 
                          value="stay" 
                          checked={carRentalMode === 'stay'} 
                          onChange={() => setCarRentalMode('stay')} 
                        />
                        <span>Mismo período de la estadía ({nights} {nights === 1 ? 'día' : 'días'})</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input 
                          type="radio" 
                          name="carMode" 
                          value="custom" 
                          checked={carRentalMode === 'custom'} 
                          onChange={() => {
                            setCarRentalMode('custom');
                            setCarStartDateStr(startDateStr);
                            setCarEndDateStr(endDateStr);
                          }} 
                        />
                        <span>Fechas específicas de arriendo</span>
                      </label>
                    </div>

                    {carRentalMode === 'custom' && (
                      <div className="public-form-grid" style={{ marginTop: '0.5rem' }}>
                        <div className="public-form-group">
                          <label className="public-label">Inicio Arriendo Vehículo</label>
                          <input 
                            type="date" 
                            className="public-input" 
                            value={carStartDateStr}
                            min={today}
                            onChange={(e) => {
                              const newCarStart = e.target.value;
                              setCarStartDateStr(newCarStart);
                              if (newCarStart >= carEndDateStr) {
                                setCarEndDateStr(format(addDays(parseISO(newCarStart), 1), 'yyyy-MM-dd'));
                              }
                            }}
                          />
                        </div>

                        <div className="public-form-group">
                          <label className="public-label">Fin Arriendo Vehículo</label>
                          <input 
                            type="date" 
                            className="public-input" 
                            value={carEndDateStr}
                            min={format(addDays(carSDate, 1), 'yyyy-MM-dd')}
                            onChange={(e) => setCarEndDateStr(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {activeCar && !activeCarIsAvailable && (
                      <p className="unavailable-warning" style={{ marginTop: '0.6rem', textAlign: 'left' }}>
                        ❌ El vehículo {activeCar.name} ya está reservado para las fechas seleccionadas.
                      </p>
                    )}

                    <div style={{ marginTop: '0.8rem', padding: '0.75rem 1rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#3b82f6', fontSize: '0.85rem' }}>
                      <Info size={18} style={{ flexShrink: 0 }} />
                      <span><strong>Aviso de disponibilidad:</strong> El vehículo seleccionado será revisado por la administración para confirmar su disponibilidad final.</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No hay vehículos registrados.</p>
            )}
          </section>

          {/* PANEL DERECHO: DESGLOSE DE COTIZACIÓN Y BOTÓN WHATSAPP */}
          <section className="public-card glass-panel summary-panel">
            <h2 className="public-card-title">
              <Sparkles size={22} color="#D97706" /> Cotización Estimada
            </h2>

            <div className="summary-details">
              <div className="summary-row">
                <span>Alojamiento ({nights} {nights === 1 ? 'noche' : 'noches'}):</span>
                <strong>${cabinTotalCost.toLocaleString('es-CL')}</strong>
              </div>

              {activeCar && (
                <div className="summary-row">
                  <span>Vehículo ({activeCar.name} - {carDays} {carDays === 1 ? 'día' : 'días'}):</span>
                  <strong>${carTotalCost.toLocaleString('es-CL')}</strong>
                </div>
              )}

              <div className="summary-total-box">
                <div className="summary-total-label">Total Estimado de la Reserva</div>
                <div className="summary-total-price">${grandTotal.toLocaleString('es-CL')}</div>
                <div className="summary-deposit-note">
                  💳 Abono 50% para asegurar reserva: <strong>${deposit50.toLocaleString('es-CL')}</strong>
                </div>
              </div>
            </div>

            <div className="client-contact-input-box" style={{ marginTop: '1.5rem' }}>
              <label className="public-label">Tu Nombre (Opcional)</label>
              <input 
                type="text" 
                className="public-input" 
                placeholder="Ej: Juan Pérez" 
                value={clientName} 
                onChange={(e) => setClientName(e.target.value)} 
              />
            </div>

            <button 
              type="button" 
              className="btn-whatsapp-reserve"
              onClick={handleOpenRequestModal}
              disabled={!activeCabinIsAvailable || (selectedCarId !== 'none' && !activeCarIsAvailable)}
            >
              <Send size={20} /> Solicitar Reserva (Pre-Reserva)
            </button>

            {!activeCabinIsAvailable && (
              <p className="unavailable-warning">
                ⚠️ Selecciona fechas de cabaña con disponibilidad para iniciar tu solicitud de reserva.
              </p>
            )}

            {selectedCarId !== 'none' && !activeCarIsAvailable && (
              <p className="unavailable-warning">
                ⚠️ El vehículo seleccionado no está disponible en las fechas indicadas.
              </p>
            )}

            <div className="public-footer-guarantee">
              <ShieldCheck size={18} color="var(--success)" />
              <span>Reserva en estado pendiente de aprobación manual por el administrador.</span>
            </div>
          </section>
        </main>
      </section>

      {/* SECCIÓN CONTACTO Y PIE DE PÁGINA */}
      <footer id="contacto" className="public-footer glass-panel">
        <div className="footer-content-grid">
          <div className="footer-brand-col">
            <img src="/images/logo_manuara.png" alt="Cabañas Manuara Logo" className="footer-brand-logo" />
            <h3 className="footer-brand-name">Cabañas Manuara</h3>
            <p className="footer-brand-text">
              Tu mejor opción de alojamiento, arriendo de vehículos y excursiones guiadas en Rapa Nui. Vivimos la hospitalidad de nuestra isla.
            </p>
          </div>

          <div className="footer-contact-col">
            <h4>Contacto & Reservas</h4>
            <ul className="footer-contact-list">
              <li><Phone size={16} color="#8C5A32" /> WhatsApp: +56 9 8456 2244</li>
              <li><Mail size={16} color="#8C5A32" /> Email: cabanasmanuara@gmail.com</li>
              <li><Home size={16} color="#8C5A32" /> Hanga Roa, Isla de Pascua - Rapa Nui, Chile</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <p>© {new Date().getFullYear()} Cabañas Manuara. Todos los derechos reservados.</p>
        </div>
      </footer>

      {/* MODAL DE SOLICITUD DE PRE-RESERVA (ESTADO PENDIENTE) */}
      {isRequestModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            maxWidth: '520px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            color: '#1e293b'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={22} color="var(--accent-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: '700' }}>Solicitar Reserva de Cabaña</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsRequestModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b' }}
              >
                <X size={22} />
              </button>
            </div>

            {requestSuccess ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <FileCheck size={54} color="#22c55e" style={{ margin: '0 auto 1rem auto' }} />
                <h4 style={{ fontSize: '1.25rem', color: '#0f172a', margin: '0 0 0.5rem 0' }}>¡Solicitud Registrada con Éxito!</h4>
                <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: '1.5' }}>
                  Tu reserva se ha registrado en estado <strong>PENDIENTE DE APROBACIÓN</strong>. Se ha abierto una ventana de WhatsApp para enviar los detalles directamente a la administración.
                </p>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1rem', marginTop: '1rem', textAlign: 'left', fontSize: '0.85rem', color: '#166534' }}>
                  ℹ️ <strong>Proceso Manual:</strong> El equipo de administración revisará tu solicitud y se comunicará contigo vía WhatsApp/Teléfono para coordinar el abono del 50% y confirmar definitivamente la reserva.
                </div>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1.5rem', padding: '12px' }}
                  onClick={() => setIsRequestModalOpen(false)}
                >
                  Entendido / Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.88rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Alojamiento:</span>
                    <strong style={{ color: '#0f172a' }}>{activeCabin ? activeCabin.name : 'Cabaña'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Fechas:</span>
                    <strong style={{ color: '#0f172a' }}>{format(sDate, 'dd/MM/yyyy')} al {format(eDate, 'dd/MM/yyyy')} ({nights} {nights === 1 ? 'noche' : 'noches'})</strong>
                  </div>
                  {activeCar && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#64748b' }}>Vehículo:</span>
                      <strong style={{ color: '#0f172a' }}>{activeCar.name}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1' }}>
                    <span style={{ color: '#0f172a', fontWeight: 'bold' }}>Total Cotizado:</span>
                    <strong style={{ color: '#2563eb', fontSize: '1rem' }}>${grandTotal.toLocaleString('es-CL')}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                    <Users size={15} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'text-bottom' }} />
                    Nombre y Apellido <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    className="public-input" 
                    placeholder="Ej: Juan Pérez" 
                    value={clientName} 
                    onChange={(e) => setClientName(e.target.value)} 
                    required 
                    style={{ background: '#f8fafc', color: '#0f172a' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                    <Phone size={15} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'text-bottom' }} />
                    Teléfono / WhatsApp de Contacto <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="tel" 
                    className="public-input" 
                    placeholder="+56 9 1234 5678" 
                    value={reqClientPhone} 
                    onChange={(e) => setReqClientPhone(e.target.value)} 
                    required 
                    style={{ background: '#f8fafc', color: '#0f172a' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                    <Mail size={15} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'text-bottom' }} />
                    Correo Electrónico (Opcional)
                  </label>
                  <input 
                    type="email" 
                    className="public-input" 
                    placeholder="correo@ejemplo.com" 
                    value={reqEmail} 
                    onChange={(e) => setReqEmail(e.target.value)} 
                    style={{ background: '#f8fafc', color: '#0f172a' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                    <MessageSquare size={15} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'text-bottom' }} />
                    Notas / Consultas Especiales (Opcional)
                  </label>
                  <textarea 
                    className="public-input" 
                    rows={2} 
                    placeholder="Ej: Necesitamos cuna de bebé o solicitar transfer aeropuerto..." 
                    value={reqNotes} 
                    onChange={(e) => setReqNotes(e.target.value)} 
                    style={{ background: '#f8fafc', color: '#0f172a', resize: 'none' }}
                  />
                </div>

                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '0.75rem', fontSize: '0.8rem', color: '#b45309' }}>
                  ⚠️ <strong>Aviso Importante:</strong> Esta solicitud guardará tu reserva en estado <strong>PENDIENTE</strong>. No se realizará ningún cobro ni aprobación automática hasta que la administración confirme la disponibilidad manualmente.
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => setIsRequestModalOpen(false)}
                    style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', background: '#25D366', color: '#ffffff', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Send size={18} /> Enviar Solicitud por WhatsApp
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
