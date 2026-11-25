import { useState, useMemo, useCallback, useRef, useEffect, useId } from 'react';
import {
  Calendar,
  Users,
  Car,
  CheckCircle2,
  AlertCircle,
  Send,
  Home,
  ShieldCheck,
  Check,
  Share2,
  Moon,
  Info,
  X,
  FileCheck,
  Phone,
  Mail,
  MapPin,
  Menu,
  Compass,
  ArrowUpRight,
  Plane
} from 'lucide-react';
import { format, differenceInDays, addDays, parseISO } from 'date-fns';
import {
  generateWhatsAppLink,
  generatePublicRequestMessage,
  isHighSeason as isHighSeasonUtil,
  getHighSeasonText,
  getLowSeasonText,
  calculateQuoteCabinCost
} from '@cabanas/shared';
import { usePublicStore } from '../store/usePublicStore';
import './PublicAvailability.css';

const FAQ_ITEMS = [
  {
    q: '¿El traslado desde el Aeropuerto Mataveri está incluido?',
    a: 'Sí. Te recibimos directamente en el Aeropuerto Mataveri con el tradicional collar de flores de bienvenida y te trasladamos sin costo adicional hasta tu cabaña, tanto a tu llegada como al regreso.'
  },
  {
    q: '¿Cuáles son los horarios de Check-In y Check-Out?',
    a: 'El Check-In estándar es a partir de las 14:00 hrs y el Check-Out hasta las 11:00 hrs. Coordinamos la recepción en función de tu vuelo LATAM para darte la mayor comodidad.'
  },
  {
    q: '¿Qué requisitos se solicitan para ingresar a Rapa Nui?',
    a: 'Debes portar cédula de identidad o pasaporte vigente, completar el Formulario Único de Ingreso (FUI) del Ministerio del Interior y presentar tu reserva de alojamiento confirmada, documento que te enviamos al concretar tu estadía.'
  },
  {
    q: '¿Cómo se confirma definitivamente una reserva?',
    a: 'Al enviar tu solicitud desde el cotizador, tu reserva queda registrada en estado pendiente. Nuestro equipo revisa la disponibilidad y te contacta por WhatsApp para coordinar el abono del 50% vía transferencia o tarjeta.'
  }
];

export default function PublicAvailability() {
  const {
    businessConfig,
    cabins,
    cars,
    tours,
    prices,
    seasonConfig,
    discountConfig,
    occupiedCabinSlots,
    occupiedCarSlots,
    submitBookingRequest
  } = usePublicStore();

  const brandName = businessConfig?.businessName || 'Cabañas Manuara';
  const brandLogo = businessConfig?.logoUrl || '/images/logo_manuara.png';
  const brandPhone = businessConfig?.contactPhone || '+56 9 8456 2244';
  const brandEmail = businessConfig?.contactEmail || 'cabanasmanuara@gmail.com';
  const cleanPhoneDigits = brandPhone.replace(/\D/g, '') || '56984562244';

  const today = format(new Date(), 'yyyy-MM-dd');
  const twoDaysLater = format(addDays(new Date(), 2), 'yyyy-MM-dd');

  const navMenuId = useId();
  const dialogTitleId = useId();
  const carHintId = useId();
  const phoneHintId = useId();

  const headerRef = useRef(null);
  const headerInnerRef = useRef(null);
  const navListRef = useRef(null);
  const dialogRef = useRef(null);

  // Modo de cotización
  const [dateMode, setDateMode] = useState('dates'); // 'dates' | 'season'
  const [seasonType, setSeasonType] = useState('low'); // 'low' | 'high'
  const [customNights, setCustomNights] = useState(3);

  // Fechas de estadía
  const [startDateStr, setStartDateStr] = useState(today);
  const [endDateStr, setEndDateStr] = useState(twoDaysLater);

  // Pasajeros
  const [adults, setAdults] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [babiesCount, setBabiesCount] = useState(0);

  // Cabaña y vehículo
  const [selectedCabinId, setSelectedCabinId] = useState('all');
  const [selectedCarId, setSelectedCarId] = useState('none');
  const [carRentalMode, setCarRentalMode] = useState('stay');
  const [carStartDateStr, setCarStartDateStr] = useState(today);
  const [carEndDateStr, setCarEndDateStr] = useState(twoDaysLater);

  // Datos de solicitud
  const [clientName, setClientName] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');

  // Estado del <dialog> nativo de pre-reserva
  const [reqClientPhone, setReqClientPhone] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState(false);

  // 1. Navbar adaptable (inline vs popover) + hide-on-scroll fallback (modern-web-guidance: navbar & content-first-noise-reduction)
  useEffect(() => {
    const header = headerRef.current;
    const inner = headerInnerRef.current;
    const menu = navListRef.current;
    if (!header || !inner || !menu) return;

    let lastHeaderWidth = 0;

    const updateNavLayout = () => {
      const currentWidth = header.clientWidth;
      const isCurrentlyWide = header.classList.contains('is-wide');

      if (!isCurrentlyWide && currentWidth <= lastHeaderWidth && lastHeaderWidth > 0) {
        return;
      }
      lastHeaderWidth = currentWidth;

      const wasOpen = !isCurrentlyWide && menu.matches(':popover-open');
      header.classList.add('is-measuring');
      header.classList.add('is-wide');
      menu.removeAttribute('popover');

      const fits = inner.scrollWidth <= inner.clientWidth + 1;

      if (!fits) {
        header.classList.remove('is-wide');
        menu.setAttribute('popover', 'auto');
        if (wasOpen && typeof menu.showPopover === 'function') {
          try {
            menu.showPopover();
          } catch {
            // ignore if browser blocks re-open during resize
          }
        }
      }

      requestAnimationFrame(() => {
        header.classList.remove('is-measuring');
      });
    };

    updateNavLayout();

    const ro = new ResizeObserver(updateNavLayout);
    ro.observe(header);
    ro.observe(menu);

    // Fallback para navegadores sin container-type: scroll-state
    let cleanupScroll = null;
    if (typeof CSS !== 'undefined' && !CSS.supports('container-type', 'scroll-state')) {
      let lastY = window.scrollY;
      const onScroll = () => {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const y = Math.max(0, Math.min(window.scrollY, maxScroll));
        if (y === lastY) return;
        header.classList.toggle('is-hidden', y > lastY && y > header.offsetHeight);
        lastY = y;
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      cleanupScroll = () => window.removeEventListener('scroll', onScroll);
    }

    return () => {
      ro.disconnect();
      if (cleanupScroll) cleanupScroll();
    };
  }, []);

  // 2. Fallback de light-dismiss para <dialog closedby="any"> en Safari (modern-web-guidance: dialog)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
    };
    dialog.addEventListener('close', handleClose);

    if ('closedBy' in HTMLDialogElement.prototype) {
      return () => {
        dialog.removeEventListener('close', handleClose);
      };
    }

    const isOutside = (e) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    let pressedOutside = false;
    const onPointerDown = (e) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const closeMobileMenuIfOpen = () => {
    const menu = navListRef.current;
    if (menu && menu.hasAttribute('popover') && typeof menu.hidePopover === 'function') {
      try {
        menu.hidePopover();
      } catch {
        // noop
      }
    }
  };

  // Fechas y noches
  const sDate = parseISO(startDateStr);
  const eDate = parseISO(endDateStr);
  const nightsCalculated = Math.max(1, differenceInDays(eDate, sDate) || 1);
  const nights = dateMode === 'season' ? Math.max(1, Number(customNights)) : nightsCalculated;
  const totalGuests = adults + childrenCount + babiesCount;

  const carSDate = carRentalMode === 'stay' ? sDate : parseISO(carStartDateStr);
  const carEDate = carRentalMode === 'stay' ? eDate : parseISO(carEndDateStr);
  const carEffectiveStartStr = carRentalMode === 'stay' ? startDateStr : carStartDateStr;
  const carEffectiveEndStr = carRentalMode === 'stay' ? endDateStr : carEndDateStr;
  const carDays = dateMode === 'season' ? nights : Math.max(1, differenceInDays(carEDate, carSDate) || 1);

  const isHighSeason = useMemo(() => {
    if (dateMode === 'season') {
      return seasonType === 'high';
    }
    if (!startDateStr) return false;
    return isHighSeasonUtil(startDateStr, seasonConfig);
  }, [dateMode, seasonType, startDateStr, seasonConfig]);

  const isCabinAvailable = useCallback(
    (cabinId) => {
      return !occupiedCabinSlots.some((slot) => {
        if (String(slot.resourceId) !== String(cabinId)) return false;
        return slot.startDate < endDateStr && slot.endDate > startDateStr;
      });
    },
    [occupiedCabinSlots, startDateStr, endDateStr]
  );

  const isCarAvailable = useCallback(
    (carId, cStart = carEffectiveStartStr, cEnd = carEffectiveEndStr) => {
      if (carId === 'none') return true;
      return !occupiedCarSlots.some((slot) => {
        if (String(slot.resourceId) !== String(carId)) return false;
        return slot.startDate < cEnd && slot.endDate > cStart;
      });
    },
    [occupiedCarSlots, carEffectiveStartStr, carEffectiveEndStr]
  );

  const availableCabins = useMemo(() => {
    return cabins.filter((c) => isCabinAvailable(c.id));
  }, [cabins, isCabinAvailable]);

  const activeCabin = useMemo(() => {
    if (selectedCabinId === 'all') {
      return availableCabins.find((c) => c.maxCapacity >= totalGuests) || availableCabins[0] || null;
    }
    return cabins.find((c) => String(c.id) === String(selectedCabinId)) || null;
  }, [selectedCabinId, availableCabins, cabins, totalGuests]);

  const activeCabinIsAvailable = activeCabin ? isCabinAvailable(activeCabin.id) : false;

  const cabinTotalCost = useMemo(() => {
    return calculateQuoteCabinCost({
      nights,
      adults,
      children: childrenCount,
      isHighSeason,
      prices,
      discountConfig
    });
  }, [nights, adults, childrenCount, isHighSeason, prices, discountConfig]);

  const activeCar = useMemo(() => {
    return cars.find((c) => String(c.id) === String(selectedCarId)) || null;
  }, [selectedCarId, cars]);

  const activeCarIsAvailable = activeCar
    ? isCarAvailable(activeCar.id, carEffectiveStartStr, carEffectiveEndStr)
    : true;

  const carTotalCost = useMemo(() => {
    if (!activeCar) return 0;
    const rate =
      activeCar.promoThresholdDays > 0 &&
      carDays >= activeCar.promoThresholdDays &&
      activeCar.promoDailyRate > 0
        ? activeCar.promoDailyRate
        : activeCar.dailyRate;
    return rate * carDays;
  }, [activeCar, carDays]);

  const grandTotal = cabinTotalCost + carTotalCost;
  const deposit50 = Math.round(grandTotal * 0.5);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setLiveStatus('Enlace copiado al portapapeles.');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setLiveStatus('No se pudo copiar el enlace automáticamente.');
    }
  };

  const handleOpenRequestModal = () => {
    setSubmitError('');
    setRequestSuccess(false);
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  };

  const handleCloseRequestModal = () => {
    const dialog = dialogRef.current;
    if (dialog && dialog.open) {
      dialog.close();
    }
  };

  const handleConfirmRequest = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!clientName.trim() || !reqClientPhone.trim()) {
      setSubmitError('Ingresa tu nombre y teléfono o WhatsApp para continuar.');
      return;
    }

    setIsSubmitting(true);

    const summaryNotif = `SOLICITUD PENDIENTE: ${clientName.trim()} solicita ${activeCabin ? activeCabin.name : 'Alojamiento'} (${nights} noches, ${totalGuests} pax)${activeCar ? ' + ' + activeCar.name : ''} por $${grandTotal.toLocaleString('es-CL')}.`;

    const result = await submitBookingRequest({
      cabinId: activeCabin ? String(activeCabin.id) : null,
      clientName: clientName.trim(),
      clientPhone: reqClientPhone.trim(),
      startDate: startDateStr,
      endDate: endDateStr,
      adults: Number(adults),
      childrenCount: Number(childrenCount),
      babiesCount: Number(babiesCount),
      totalCost: grandTotal,
      depositAmount: deposit50,
      notes: `Solicitud Web Pública | Email: ${reqEmail || 'N/I'} | Notas: ${reqNotes || 'Sin notas'}`,
      carId: activeCar && selectedCarId !== 'none' ? String(activeCar.id) : null,
      carStartDate: carEffectiveStartStr,
      carEndDate: carEffectiveEndStr,
      carTotalCost,
      carDepositAmount: Math.round(carTotalCost * 0.5),
      notificationTitle: 'Nueva Solicitud de Reserva Web',
      notificationMessage: summaryNotif
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error || 'No pudimos registrar la solicitud. Intenta nuevamente.');
      return;
    }

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
      businessName: brandName
    });

    const waUrl = generateWhatsAppLink(cleanPhoneDigits, waMsg);
    if (waUrl) {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }

    setRequestSuccess(true);
    setLiveStatus('Solicitud de pre-reserva registrada en estado pendiente.');
  };

  return (
    <div className="manuara-site" id="inicio">
      <a href="#contenido-principal" className="skip-link visually-hidden">
        Saltar al contenido principal
      </a>

      {/* Región de anuncios polite centralizada */}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </div>

      {/* BARRA DE NAVEGACIÓN COMPACTA (1 solo <nav> + popover nativo en móvil) */}
      <header className="site-header" ref={headerRef}>
        <div className="site-header-inner" ref={headerInnerRef}>
          <a href="#inicio" className="site-brand" aria-label={`${brandName} — Inicio`}>
            <img
              src={brandLogo}
              alt=""
              width="42"
              height="42"
              className="site-brand-logo"
            />
            <span className="site-brand-text">
              <strong className="site-brand-name">{brandName}</strong>
              <span className="site-brand-meta">Hanga Roa · Rapa Nui</span>
            </span>
          </a>

          <nav className="site-nav" aria-label="Principal">
            <button
              type="button"
              className="nav-menu-trigger"
              {...{
                popovertarget: navMenuId,
                popovertargetaction: 'toggle'
              }}
              aria-controls={navMenuId}
            >
              <Menu size={18} aria-hidden="true" />
              <span>Menú</span>
            </button>

            <ul
              id={navMenuId}
              ref={navListRef}
              className="site-nav-list"
              {...{ popover: 'auto' }}
            >
              <li>
                <a href="#cabanas" onClick={closeMobileMenuIfOpen}>
                  Cabañas
                </a>
              </li>
              <li>
                <a href="#movilidad" onClick={closeMobileMenuIfOpen}>
                  Vehículos y Tours
                </a>
              </li>
              <li>
                <a href="#ubicacion" onClick={closeMobileMenuIfOpen}>
                  Ubicación
                </a>
              </li>
              <li>
                <a href="#preguntas" onClick={closeMobileMenuIfOpen}>
                  Preguntas
                </a>
              </li>
              <li>
                <a href="#contacto" onClick={closeMobileMenuIfOpen}>
                  Contacto
                </a>
              </li>
              <li className="nav-item-cta">
                <a
                  href="#cotizador"
                  className="nav-cta-link"
                  onClick={closeMobileMenuIfOpen}
                >
                  Consultar disponibilidad
                </a>
              </li>
            </ul>
          </nav>

          <button
            type="button"
            className="header-share-btn"
            onClick={handleCopyLink}
            aria-label="Copiar enlace de esta página"
          >
            {copiedLink ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Share2 size={16} aria-hidden="true" />
            )}
            <span>{copiedLink ? 'Copiado' : 'Compartir'}</span>
          </button>
        </div>
      </header>

      <main id="contenido-principal">
        {/* HERO EDITORIAL A SANGRE COMPLETA */}
        <section className="hero-editorial" aria-labelledby="hero-heading">
          <img
            src="/images/hero.jpg"
            alt="Cabaña de madera rodeada de vegetación tropical frente al océano y los moais al atardecer en Rapa Nui"
            width="1408"
            height="768"
            {...{ fetchpriority: 'high' }}
            className="hero-photo"
          />
          <div className="hero-scrim" aria-hidden="true" />

          <div className="hero-inner container">
            <div className="hero-copy">
              <p className="eyebrow eyebrow-light">Hanga Roa · Isla de Pascua</p>
              <h1 id="hero-heading" tabIndex={-1} className="hero-headline">
                Tu refugio tranquilo en el corazón de Rapa Nui
              </h1>
              <p className="hero-lead">
                Cabañas independientes completamente equipadas y arriendo de vehículos en el mismo recinto, con recepción y traslado gratuito desde el Aeropuerto Mataveri.
              </p>

              <div className="hero-cta-group">
                <a href="#cotizador" className="btn-editorial-primary">
                  <Calendar size={18} aria-hidden="true" />
                  <span>Cotizar estadía</span>
                </a>
                <a href="#cabanas" className="btn-editorial-ghost">
                  <span>Ver cabañas</span>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </div>
            </div>

            <dl className="hero-facts">
              <div className="hero-fact">
                <dt>Aeropuerto Mataveri</dt>
                <dd>Traslado ida y vuelta incluido</dd>
              </div>
              <div className="hero-fact">
                <dt>Alojamiento</dt>
                <dd>Cocina equipada, terraza y WiFi</dd>
              </div>
              <div className="hero-fact">
                <dt>Movilidad</dt>
                <dd>Vehículos y guías locales</dd>
              </div>
              <div className="hero-fact">
                <dt>Atención directa</dt>
                <dd>Confirmación sin intermediarios</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* IDENTIDAD Y HOSPITALIDAD (Asimétrico editorial, sin 4 tarjetas clónicas) */}
        <section className="editorial-section container" aria-labelledby="hospitality-heading">
          <div className="editorial-split">
            <div className="editorial-split-lead">
              <p className="eyebrow">Hospitalidad pascuense</p>
              <h2 id="hospitality-heading" className="section-heading">
                Un espacio sereno para descansar después de recorrer la isla
              </h2>
              <p className="editorial-body">
                En {brandName} cuidamos cada detalle de tu llegada: desde el recibimiento en pista con el tradicional collar de flores hasta la coordinación de tu vehículo para explorar Rapa Nui a tu propio ritmo.
              </p>
            </div>

            <ol className="hospitality-ledger">
              <li>
                <span className="ledger-num" aria-hidden="true">01</span>
                <div>
                  <h3>Recepción según tu vuelo LATAM</h3>
                  <p>
                    Te esperamos al aterrizar en el Aeropuerto Mataveri con collar de flores y te llevamos directo a tu cabaña, a solo tres minutos de distancia.
                  </p>
                </div>
              </li>
              <li>
                <span className="ledger-num" aria-hidden="true">02</span>
                <div>
                  <h3>Privacidad y entorno de jardín</h3>
                  <p>
                    Cabañas independientes en un sector tranquilo de Hanga Roa, con cocina equipada, agua caliente continua, terraza privada y estacionamiento.
                  </p>
                </div>
              </li>
              <li>
                <span className="ledger-num" aria-hidden="true">03</span>
                <div>
                  <h3>Todo resuelto en un solo lugar</h3>
                  <p>
                    Suma un vehículo acondicionado para los caminos de la isla o coordina excursiones con guías acreditados directamente con nosotros.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* CATÁLOGO DE CABAÑAS */}
        <section id="cabanas" className="editorial-section container" aria-labelledby="cabins-heading">
          <header className="section-bar">
            <div>
              <p className="eyebrow">Alojamientos</p>
              <h2 id="cabins-heading" className="section-heading">
                Nuestras cabañas en Hanga Roa
              </h2>
            </div>
            <p className="section-aside">
              {cabins.length} {cabins.length === 1 ? 'unidad disponible' : 'unidades independientes'} para parejas, familias y grupos.
            </p>
          </header>

          <ul className="cabins-editorial-grid" role="list">
            {cabins.map((cabin) => (
              <li key={cabin.id} className="cabin-editorial-card">
                <div
                  className="cabin-accent-rule"
                  style={{ '--cabin-tint': cabin.color || 'var(--accent-primary)' }}
                  aria-hidden="true"
                />
                <div className="cabin-card-top">
                  <span className="cabin-capacity-tag">
                    <Users size={14} aria-hidden="true" />
                    <span>Hasta {cabin.maxCapacity} huéspedes</span>
                  </span>
                </div>

                <h3 className="cabin-title">{cabin.name}</h3>
                <p className="cabin-summary">
                  Espacio independiente rodeado de vegetación con terraza privada, estacionamiento y equipamiento completo para estadías cortas o prolongadas.
                </p>

                <ul className="cabin-perks" role="list">
                  <li>
                    <Check size={15} aria-hidden="true" />
                    <span>Cocina equipada y agua caliente continua</span>
                  </li>
                  <li>
                    <Check size={15} aria-hidden="true" />
                    <span>Traslado gratuito Aeropuerto Mataveri</span>
                  </li>
                  <li>
                    <Check size={15} aria-hidden="true" />
                    <span>WiFi y estacionamiento privado</span>
                  </li>
                </ul>

                <div className="cabin-card-cta">
                  <a
                    href="#cotizador"
                    className="btn-card-select"
                    onClick={() => {
                      setSelectedCabinId(String(cabin.id));
                      setLiveStatus(`${cabin.name} seleccionada en el cotizador.`);
                    }}
                  >
                    <span>Cotizar {cabin.name}</span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* VEHÍCULOS Y TOURS (Banda cálida con datos reales sincronizados de Supabase) */}
        <section id="movilidad" className="editorial-band" aria-labelledby="mobility-heading">
          <div className="container">
            <header className="section-bar">
              <div>
                <p className="eyebrow">Explora la isla</p>
                <h2 id="mobility-heading" className="section-heading">
                  Arriendo de vehículos y excursiones
                </h2>
              </div>
              <p className="section-aside">
                Entrega directa en tus cabañas o en el aeropuerto, sin traslados extra.
              </p>
            </header>

            <div className="mobility-columns">
              <div className="mobility-block">
                <div className="mobility-block-head">
                  <Car size={20} aria-hidden="true" />
                  <h3>Flota disponible para arriendo</h3>
                </div>
                <p className="mobility-intro">
                  Vehículos revisados y aptos para los caminos de Rapa Nui. Puedes añadir cualquiera directamente en tu cotización.
                </p>

                {cars.length > 0 ? (
                  <ul className="catalog-ledger" role="list">
                    {cars.map((car) => (
                      <li key={car.id} className="catalog-ledger-row">
                        <div>
                          <strong>{car.name}</strong>
                          <span className="catalog-sub">
                            {car.promoThresholdDays > 0 && car.promoDailyRate > 0
                              ? `Desde ${car.promoThresholdDays} días: $${Number(car.promoDailyRate).toLocaleString('es-CL')}/día`
                              : 'Entrega en cabaña o aeropuerto'}
                          </span>
                        </div>
                        <div className="catalog-price-col">
                          <span className="catalog-price">
                            ${Number(car.dailyRate || 0).toLocaleString('es-CL')}
                          </span>
                          <span className="catalog-unit">/ día</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mobility-empty">
                    Consulta disponibilidad de vehículos al enviar tu pre-reserva.
                  </p>
                )}
              </div>

              <div className="mobility-block">
                <div className="mobility-block-head">
                  <Compass size={20} aria-hidden="true" />
                  <h3>Excursiones con guías locales</h3>
                </div>
                <p className="mobility-intro">
                  Recorre Ahu Tongariki, la cantera de Rano Raraku, la aldea ceremonial de Orongo y playa Anakena acompañado por guías acreditados.
                </p>

                {tours.length > 0 ? (
                  <ul className="catalog-ledger" role="list">
                    {tours.slice(0, 4).map((tour) => (
                      <li key={tour.id} className="catalog-ledger-row">
                        <div>
                          <strong>{tour.name}</strong>
                          <span className="catalog-sub">
                            {tour.duration || 'Consultar duración'}
                            {tour.description ? ` · ${tour.description}` : ''}
                          </span>
                        </div>
                        <div className="catalog-price-col">
                          <span className="catalog-price">
                            ${Number(tour.price || 0).toLocaleString('es-CL')}
                          </span>
                          <span className="catalog-unit">/ persona</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="tour-editorial-note">
                    <p>
                      Coordinamos recorridos privados o grupales según los días de tu estadía y las condiciones climáticas de la isla.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* MOTOR DE DISPONIBILIDAD Y COTIZACIÓN EN TIEMPO REAL */}
        <section id="cotizador" className="editorial-section container" aria-labelledby="booking-heading">
          <header className="section-bar">
            <div>
              <p className="eyebrow">Reserva directa</p>
              <h2 id="booking-heading" className="section-heading">
                Disponibilidad y cotización en vivo
              </h2>
            </div>
            <p className="section-aside">
              Tarifas sincronizadas en tiempo real. Sin cobro automático ni comisiones de plataformas.
            </p>
          </header>

          <div className="booking-desk">
            {/* COLUMNA IZQUIERDA: CONFIGURACIÓN */}
            <div className="booking-controls-panel">
              <div className="booking-step">
                <h3 className="step-heading">
                  <span className="step-index">1</span>
                  <span>Fechas y pasajeros</span>
                </h3>

                <div className="segmented-control" role="group" aria-label="Modo de cotización">
                  <button
                    type="button"
                    className={`segment-btn ${dateMode === 'dates' ? 'is-active' : ''}`}
                    aria-pressed={dateMode === 'dates'}
                    onClick={() => setDateMode('dates')}
                  >
                    Fechas exactas
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${dateMode === 'season' ? 'is-active' : ''}`}
                    aria-pressed={dateMode === 'season'}
                    onClick={() => setDateMode('season')}
                  >
                    Estimar por temporada
                  </button>
                </div>

                {dateMode === 'dates' ? (
                  <div className="field-pair">
                    <div className="field">
                      <label htmlFor="stay-checkin" className="field-label">
                        Llegada (Check-In)
                      </label>
                      <input
                        id="stay-checkin"
                        type="date"
                        className="field-input"
                        value={startDateStr}
                        min={today}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          if (!newStart) return;
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

                    <div className="field">
                      <label htmlFor="stay-checkout" className="field-label">
                        Salida (Check-Out)
                      </label>
                      <input
                        id="stay-checkout"
                        type="date"
                        className="field-input"
                        value={endDateStr}
                        min={format(addDays(sDate, 1), 'yyyy-MM-dd')}
                        onChange={(e) => {
                          const newEnd = e.target.value;
                          if (!newEnd) return;
                          setEndDateStr(newEnd);
                          if (carRentalMode === 'stay') {
                            setCarEndDateStr(newEnd);
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="field-pair">
                    <div className="field">
                      <label htmlFor="season-select" className="field-label">
                        Temporada estimada
                      </label>
                      <select
                        id="season-select"
                        className="field-input"
                        value={seasonType}
                        onChange={(e) => setSeasonType(e.target.value)}
                      >
                        <option value="low">
                          Temporada Baja ({getLowSeasonText(seasonConfig)})
                        </option>
                        <option value="high">
                          Temporada Alta ({getHighSeasonText(seasonConfig)})
                        </option>
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="custom-nights" className="field-label">
                        Cantidad de noches
                      </label>
                      <div className="stepper-inline">
                        <button
                          type="button"
                          className="stepper-btn"
                          aria-label="Disminuir noches"
                          onClick={() => setCustomNights(Math.max(1, customNights - 1))}
                        >
                          −
                        </button>
                        <input
                          id="custom-nights"
                          type="number"
                          className="field-input stepper-number-input"
                          value={customNights}
                          min={1}
                          onChange={(e) =>
                            setCustomNights(Math.max(1, parseInt(e.target.value, 10) || 1))
                          }
                        />
                        <button
                          type="button"
                          className="stepper-btn"
                          aria-label="Aumentar noches"
                          onClick={() => setCustomNights(customNights + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <p className="stay-meta-pill">
                  <Moon size={15} aria-hidden="true" />
                  <span>
                    <strong>{nights}</strong> {nights === 1 ? 'noche' : 'noches'} ·{' '}
                    {isHighSeason
                      ? seasonConfig?.highSeasonName || 'Temporada Alta'
                      : seasonConfig?.lowSeasonName || 'Temporada Baja'}
                  </span>
                </p>

                <fieldset className="pax-fieldset">
                  <legend className="field-label">Huéspedes</legend>
                  <div className="pax-grid">
                    <div className="pax-tile">
                      <span className="pax-name">Adultos</span>
                      <div className="pax-controls">
                        <button
                          type="button"
                          className="stepper-btn"
                          aria-label="Disminuir adultos"
                          onClick={() => setAdults(Math.max(1, adults - 1))}
                        >
                          −
                        </button>
                        <span className="pax-count" aria-live="polite">
                          {adults}
                        </span>
                        <button
                          type="button"
                          className="stepper-btn"
                          aria-label="Aumentar adultos"
                          onClick={() => setAdults(adults + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="pax-tile">
                      <span className="pax-name">Niños</span>
                      <div className="pax-controls">
                        <button
                          type="button"
                          className="stepper-btn"
                          aria-label="Disminuir niños"
                          onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}
                        >
                          −
                        </button>
                        <span className="pax-count" aria-live="polite">
                          {childrenCount}
                        </span>
                        <button
                          type="button"
                          className="stepper-btn"
                          aria-label="Aumentar niños"
                          onClick={() => setChildrenCount(childrenCount + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="pax-tile">
                      <span className="pax-name">Bebés</span>
                      <div className="pax-controls">
                        <button
                          type="button"
                          className="stepper-btn"
                          aria-label="Disminuir bebés"
                          onClick={() => setBabiesCount(Math.max(0, babiesCount - 1))}
                        >
                          −
                        </button>
                        <span className="pax-count" aria-live="polite">
                          {babiesCount}
                        </span>
                        <button
                          type="button"
                          className="stepper-btn"
                          aria-label="Aumentar bebés"
                          onClick={() => setBabiesCount(babiesCount + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </fieldset>
              </div>

              <hr className="editorial-rule" />

              <div className="booking-step">
                <h3 className="step-heading">
                  <span className="step-index">2</span>
                  <span>Alojamiento</span>
                </h3>

                <div className="field">
                  <label htmlFor="cabin-select" className="field-label">
                    Elegir cabaña
                  </label>
                  <select
                    id="cabin-select"
                    className="field-input"
                    value={selectedCabinId}
                    onChange={(e) => setSelectedCabinId(e.target.value)}
                  >
                    <option value="all">
                      Asignar la mejor cabaña disponible automáticamente
                    </option>
                    {cabins.map((cabin) => {
                      const avail = isCabinAvailable(cabin.id);
                      return (
                        <option key={cabin.id} value={cabin.id}>
                          {cabin.name} (hasta {cabin.maxCapacity} pax) —{' '}
                          {avail ? 'Disponible' : 'Sin disponibilidad'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {activeCabin && (
                  <div
                    className={`availability-banner ${
                      activeCabinIsAvailable ? 'is-available' : 'is-unavailable'
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    {activeCabinIsAvailable ? (
                      <>
                        <CheckCircle2 size={20} aria-hidden="true" />
                        <div>
                          <strong>Disponible para tus fechas</strong>
                          <p>
                            {activeCabin.name} · Capacidad recomendada de hasta{' '}
                            {activeCabin.maxCapacity} personas.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={20} aria-hidden="true" />
                        <div>
                          <strong>Sin disponibilidad en ese rango</strong>
                          <p>
                            Prueba con otra cabaña de la lista o ajusta las fechas de llegada y salida.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <hr className="editorial-rule" />

              <div className="booking-step">
                <h3 className="step-heading">
                  <span className="step-index">3</span>
                  <span>Arriendo de vehículo (opcional)</span>
                </h3>

                {cars.length > 0 ? (
                  <div className="field">
                    <label htmlFor="car-select" className="field-label">
                      Agregar vehículo a tu estadía
                    </label>
                    <span id={carHintId} className="field-hint">
                      La disponibilidad final del vehículo se confirma junto a tu solicitud.
                    </span>
                    <select
                      id="car-select"
                      className="field-input"
                      aria-describedby={carHintId}
                      value={selectedCarId}
                      onChange={(e) => setSelectedCarId(e.target.value)}
                    >
                      <option value="none">Sin arriendo de vehículo</option>
                      {cars.map((car) => {
                        const avail = isCarAvailable(
                          car.id,
                          carEffectiveStartStr,
                          carEffectiveEndStr
                        );
                        return (
                          <option key={car.id} value={car.id} disabled={!avail}>
                            {car.name} — ${Number(car.dailyRate || 0).toLocaleString('es-CL')}/día
                            {avail ? ' (Disponible)' : ' (Ocupado en esas fechas)'}
                          </option>
                        );
                      })}
                    </select>

                    {selectedCarId !== 'none' && (
                      <div className="car-dates-box">
                        <fieldset className="radio-group">
                          <legend className="field-label">Período del vehículo</legend>
                          <div className="radio-options">
                            <label className="radio-option">
                              <input
                                type="radio"
                                name="carMode"
                                value="stay"
                                checked={carRentalMode === 'stay'}
                                onChange={() => setCarRentalMode('stay')}
                              />
                              <span>
                                Toda la estadía ({nights} {nights === 1 ? 'día' : 'días'})
                              </span>
                            </label>

                            <label className="radio-option">
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
                              <span>Fechas específicas</span>
                            </label>
                          </div>
                        </fieldset>

                        {carRentalMode === 'custom' && (
                          <div className="field-pair">
                            <div className="field">
                              <label htmlFor="car-start" className="field-label">
                                Retiro del vehículo
                              </label>
                              <input
                                id="car-start"
                                type="date"
                                className="field-input"
                                value={carStartDateStr}
                                min={today}
                                onChange={(e) => {
                                  const newCarStart = e.target.value;
                                  if (!newCarStart) return;
                                  setCarStartDateStr(newCarStart);
                                  if (newCarStart >= carEndDateStr) {
                                    setCarEndDateStr(
                                      format(addDays(parseISO(newCarStart), 1), 'yyyy-MM-dd')
                                    );
                                  }
                                }}
                              />
                            </div>

                            <div className="field">
                              <label htmlFor="car-end" className="field-label">
                                Devolución del vehículo
                              </label>
                              <input
                                id="car-end"
                                type="date"
                                className="field-input"
                                value={carEndDateStr}
                                min={format(addDays(carSDate, 1), 'yyyy-MM-dd')}
                                onChange={(e) => {
                                  if (e.target.value) setCarEndDateStr(e.target.value);
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {activeCar && !activeCarIsAvailable && (
                          <p className="inline-error" role="alert">
                            <AlertCircle size={16} aria-hidden="true" />
                            <span>
                              {activeCar.name} ya está reservado para las fechas indicadas.
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="field-hint">No hay vehículos registrados por el momento.</p>
                )}
              </div>
            </div>

            {/* COLUMNA DERECHA: RESUMEN DE ESTADÍA */}
            <aside className="booking-summary-panel" aria-label="Resumen de cotización">
              <div className="summary-card">
                <p className="eyebrow">Resumen estimado</p>
                <h3 className="summary-heading">
                  {activeCabin ? activeCabin.name : 'Selecciona disponibilidad'}
                </h3>

                <dl className="summary-ledger">
                  <div className="summary-line">
                    <dt>
                      Alojamiento ({nights} {nights === 1 ? 'noche' : 'noches'}, {totalGuests}{' '}
                      {totalGuests === 1 ? 'persona' : 'personas'})
                    </dt>
                    <dd>${cabinTotalCost.toLocaleString('es-CL')}</dd>
                  </div>

                  {activeCar && (
                    <div className="summary-line">
                      <dt>
                        {activeCar.name} ({carDays} {carDays === 1 ? 'día' : 'días'})
                      </dt>
                      <dd>${carTotalCost.toLocaleString('es-CL')}</dd>
                    </div>
                  )}

                  <div className="summary-line summary-line-muted">
                    <dt>Traslado Aeropuerto Mataveri</dt>
                    <dd>Incluido</dd>
                  </div>
                </dl>

                <div className="summary-total-block" aria-live="polite">
                  <div className="summary-total-row">
                    <span>Total estimado</span>
                    <strong className="summary-amount">
                      ${grandTotal.toLocaleString('es-CL')}
                    </strong>
                  </div>
                  <p className="summary-deposit">
                    Abono sugerido del 50% al confirmar:{' '}
                    <strong>${deposit50.toLocaleString('es-CL')}</strong>
                  </p>
                </div>

                <div className="field">
                  <label htmlFor="quick-client-name" className="field-label">
                    Tu nombre (opcional)
                  </label>
                  <input
                    id="quick-client-name"
                    type="text"
                    className="field-input"
                    autoComplete="name"
                    placeholder="Ej: Camila Rapa"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn-booking-submit"
                  onClick={handleOpenRequestModal}
                  disabled={
                    !activeCabinIsAvailable ||
                    (selectedCarId !== 'none' && !activeCarIsAvailable)
                  }
                >
                  <Send size={18} aria-hidden="true" />
                  <span>Solicitar pre-reserva</span>
                </button>

                {!activeCabinIsAvailable && (
                  <p className="summary-warning" role="status">
                    <AlertCircle size={15} aria-hidden="true" />
                    <span>Selecciona fechas con disponibilidad para enviar tu solicitud.</span>
                  </p>
                )}

                <p className="summary-guarantee">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>
                    Tu solicitud queda pendiente de confirmación manual por el equipo de{' '}
                    {brandName}.
                  </span>
                </p>
              </div>
            </aside>
          </div>
        </section>

        {/* UBICACIÓN EN HANGA ROA */}
        <section id="ubicacion" className="editorial-band" aria-labelledby="location-heading">
          <div className="container">
            <header className="section-bar">
              <div>
                <p className="eyebrow">Hanga Roa</p>
                <h2 id="location-heading" className="section-heading">
                  Dónde estamos ubicados
                </h2>
              </div>
              <a
                href="https://www.google.com/maps/search/?api=1&query=Caba%C3%B1as+Manuara+Hanga+Roa+Rapa+Nui"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-editorial-link"
              >
                <span>Abrir en Google Maps</span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </header>

            <div className="location-split">
              <div className="map-frame">
                <iframe
                  title={`Mapa de ubicación de ${brandName} en Hanga Roa, Rapa Nui`}
                  src="https://maps.google.com/maps?q=Caba%C3%B1as%20Manuara%2C%20Avareipua%2C%20Hanga%20Roa%2C%20Isla%20de%20Pascua&t=&z=16&ie=UTF8&iwloc=&output=embed"
                  width="600"
                  height="420"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>

              <dl className="proximity-ledger">
                <div className="proximity-row">
                  <dt>
                    <Plane size={18} aria-hidden="true" />
                    <span>Aeropuerto Mataveri</span>
                  </dt>
                  <dd>A 3 minutos en vehículo, con traslado gratuito incluido.</dd>
                </div>
                <div className="proximity-row">
                  <dt>
                    <MapPin size={18} aria-hidden="true" />
                    <span>Caleta Hanga Piko</span>
                  </dt>
                  <dd>A pocos minutos a pie para ver el atardecer y actividades marinas.</dd>
                </div>
                <div className="proximity-row">
                  <dt>
                    <Home size={18} aria-hidden="true" />
                    <span>Centro de Hanga Roa</span>
                  </dt>
                  <dd>Acceso cercano a restaurantes, supermercados y feria artesanal.</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* PREGUNTAS FRECUENTES (Acordeón nativo <details>/<summary> según guía accordion) */}
        <section
          id="preguntas"
          className="editorial-section container"
          aria-labelledby="faq-heading"
        >
          <div className="faq-split">
            <div>
              <p className="eyebrow">Información práctica</p>
              <h2 id="faq-heading" className="section-heading">
                Preguntas frecuentes antes de viajar
              </h2>
              <p className="editorial-body">
                Resolvemos las consultas habituales sobre traslados, horarios, requisitos de ingreso a la isla y el proceso de reserva.
              </p>
            </div>

            <div className="faq-accordion">
              {FAQ_ITEMS.map((item) => (
                <details key={item.q} className="faq-item">
                  <summary className="faq-summary">{item.q}</summary>
                  <div className="faq-answer">
                    <p>{item.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER EDITORIAL OSCURO (BASALTO) */}
      <footer id="contacto" className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <img
                src={brandLogo}
                alt=""
                width="52"
                height="52"
                loading="lazy"
                className="footer-logo"
              />
              <h2 className="footer-brand-heading">{brandName}</h2>
              <p className="footer-description">
                Alojamiento independiente, arriendo de vehículos y hospitalidad local en Hanga Roa, Rapa Nui.
              </p>
            </div>

            <div className="footer-col">
              <h3>Contacto directo</h3>
              <ul className="footer-links" role="list">
                <li>
                  <a
                    href={`https://wa.me/${cleanPhoneDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Phone size={16} aria-hidden="true" />
                    <span>WhatsApp: {brandPhone}</span>
                  </a>
                </li>
                <li>
                  <a href={`mailto:${brandEmail}`}>
                    <Mail size={16} aria-hidden="true" />
                    <span>{brandEmail}</span>
                  </a>
                </li>
                <li className="footer-address">
                  <MapPin size={16} aria-hidden="true" />
                  <span>Avareipua, Hanga Roa, Rapa Nui, Chile</span>
                </li>
              </ul>
            </div>

            <div className="footer-col">
              <h3>Navegación</h3>
              <ul className="footer-links" role="list">
                <li>
                  <a href="#cabanas">Nuestras cabañas</a>
                </li>
                <li>
                  <a href="#movilidad">Vehículos y tours</a>
                </li>
                <li>
                  <a href="#cotizador">Cotizador en vivo</a>
                </li>
                <li>
                  <a href="#ubicacion">Ubicación en Hanga Roa</a>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-legal">
            <p>© {new Date().getFullYear()} {brandName}. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>

      {/* MODAL NATIVO <dialog> DE SOLICITUD DE PRE-RESERVA (Sin role="dialog" ni aria-modal redundantes) */}
      <dialog
        ref={dialogRef}
        className="booking-dialog"
        {...{ closedby: 'any' }}
        aria-labelledby={dialogTitleId}
      >
        <div className="dialog-surface">
          <header className="dialog-header">
            <h1 id={dialogTitleId} className="dialog-title">
              {requestSuccess ? 'Solicitud registrada' : 'Completar solicitud de pre-reserva'}
            </h1>
            <button
              type="button"
              className="dialog-close-btn"
              onClick={handleCloseRequestModal}
              aria-label="Cerrar ventana"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          {requestSuccess ? (
            <div className="dialog-success">
              <FileCheck size={44} className="dialog-success-icon" aria-hidden="true" />
              <p className="dialog-success-lead">
                Tu solicitud quedó registrada en estado <strong>pendiente de aprobación</strong>.
                Abrimos WhatsApp con el resumen para acelerar el contacto con administración.
              </p>
              <div className="dialog-info-box">
                <Info size={18} aria-hidden="true" />
                <p>
                  <strong>Confirmación manual:</strong> revisaremos la disponibilidad y te
                  contactaremos por WhatsApp para coordinar el abono del 50% y emitir tu reserva
                  definitiva.
                </p>
              </div>
              <button
                type="button"
                className="btn-booking-submit"
                onClick={handleCloseRequestModal}
              >
                Entendido
              </button>
            </div>
          ) : (
            <form onSubmit={handleConfirmRequest} className="dialog-form" noValidate>
              {submitError && (
                <div className="dialog-error" role="alert">
                  <AlertCircle size={18} aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
              )}

              <dl className="dialog-recap">
                <div>
                  <dt>Alojamiento</dt>
                  <dd>{activeCabin ? activeCabin.name : 'Cabaña'}</dd>
                </div>
                <div>
                  <dt>Estadía</dt>
                  <dd>
                    {format(sDate, 'dd/MM/yyyy')} al {format(eDate, 'dd/MM/yyyy')} ({nights}{' '}
                    {nights === 1 ? 'noche' : 'noches'})
                  </dd>
                </div>
                {activeCar && (
                  <div>
                    <dt>Vehículo</dt>
                    <dd>
                      {activeCar.name} ({carDays} {carDays === 1 ? 'día' : 'días'})
                    </dd>
                  </div>
                )}
                <div className="dialog-recap-total">
                  <dt>Total estimado</dt>
                  <dd>${grandTotal.toLocaleString('es-CL')}</dd>
                </div>
              </dl>

              <div className="field">
                <label htmlFor="req-name" className="field-label">
                  Nombre y apellido <span aria-hidden="true">*</span>
                </label>
                <input
                  id="req-name"
                  type="text"
                  className="field-input"
                  autoComplete="name"
                  autoFocus
                  required
                  placeholder="Ej: Camila Rapa"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="req-phone" className="field-label">
                  Teléfono o WhatsApp <span aria-hidden="true">*</span>
                </label>
                <span id={phoneHintId} className="field-hint">
                  Incluye código de país para coordinar tu llegada y abono.
                </span>
                <input
                  id="req-phone"
                  type="tel"
                  className="field-input"
                  autoComplete="tel"
                  aria-describedby={phoneHintId}
                  required
                  placeholder="+56 9 1234 5678"
                  value={reqClientPhone}
                  onChange={(e) => setReqClientPhone(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="req-email" className="field-label">
                  Correo electrónico (opcional)
                </label>
                <input
                  id="req-email"
                  type="email"
                  className="field-input"
                  autoComplete="email"
                  placeholder="correo@ejemplo.com"
                  value={reqEmail}
                  onChange={(e) => setReqEmail(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="req-notes" className="field-label">
                  Notas o vuelo de llegada (opcional)
                </label>
                <textarea
                  id="req-notes"
                  className="field-input field-textarea"
                  rows={2}
                  placeholder="Ej: Vuelo LATAM LA841, necesitamos cuna de bebé..."
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                />
              </div>

              <p className="dialog-notice">
                Esta solicitud guarda una pre-reserva en estado <strong>pendiente</strong>. No se
                realiza ningún cobro ni aprobación automática.
              </p>

              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn-dialog-cancel"
                  onClick={handleCloseRequestModal}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-booking-submit"
                  disabled={isSubmitting}
                >
                  <Send size={17} aria-hidden="true" />
                  <span>{isSubmitting ? 'Registrando...' : 'Enviar solicitud por WhatsApp'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </div>
  );
}
