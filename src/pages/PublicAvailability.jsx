import { useState, useMemo } from 'react';
import { 
  Calendar, Users, Car, CheckCircle2, AlertCircle, 
  Send, Home, ShieldCheck, Check, Share2, Sparkles, Moon, Info
} from 'lucide-react';
import { format, differenceInDays, addDays, parseISO } from 'date-fns';
import { useStore, getSupabase } from '../store/useStore';
import './PublicAvailability.css';

export default function PublicAvailability() {
  const { businessConfig, cabins, cars, prices, reservations, carReservations, syncConfig } = useStore();

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

  // Solicitar por WhatsApp
  const handleSendWhatsApp = () => {
    const bPhone = businessConfig.contactPhone?.replace(/\D/g, '') || '56912345678';
    const bName = businessConfig.businessName || 'Cabañas y Servicios';

    let msg = `¡Hola *${bName}*! 👋\n`;
    if (clientName.trim()) {
      msg += `Mi nombre es *${clientName.trim()}*.\n`;
    }
    msg += `Consulté disponibilidad desde su portal web y quisiera solicitar la siguiente reserva:\n\n`;

    if (activeCabin) {
      msg += `🏡 *Cabaña:* ${activeCabin.name}\n`;
    }
    msg += `📅 *Llegada:* ${format(sDate, 'dd/MM/yyyy')}\n`;
    msg += `📅 *Salida:* ${format(eDate, 'dd/MM/yyyy')} (${nights} ${nights === 1 ? 'noche' : 'noches'})\n`;
    msg += `👥 *Pasajeros:* ${adults} Adulto(s)`;
    if (childrenCount > 0) msg += `, ${childrenCount} Niño(s)`;
    if (babiesCount > 0) msg += `, ${babiesCount} Bebé(s)`;
    msg += `\n`;

    if (activeCar) {
      msg += `🚗 *Vehículo:* ${activeCar.name} (${activeCar.plate || ''})\n`;
      if (carRentalMode === 'stay') {
        msg += `   ↳ *Período:* Toda la estadía (${carDays} ${carDays === 1 ? 'día' : 'días'})\n`;
      } else {
        msg += `   ↳ *Fechas Vehículo:* ${format(carSDate, 'dd/MM/yyyy')} al ${format(carEDate, 'dd/MM/yyyy')} (${carDays} ${carDays === 1 ? 'día' : 'días'})\n`;
      }
    }

    msg += `\n💰 *Cotización Estimada:* $${grandTotal.toLocaleString('es-CL')}\n`;
    msg += `💳 *Abono 50% para Reservar:* $${deposit50.toLocaleString('es-CL')}\n\n`;
    msg += `¿Me confirman la disponibilidad para transferir el abono y concretar? Muchas gracias! 😊`;

    // Registrar notificación interna
    const summaryNotif = `${clientName || 'Cliente Web'} consultó ${activeCabin ? activeCabin.name : 'Alojamiento'} (${nights} noches, ${totalGuests} pax) ${activeCar ? '+ ' + activeCar.name : ''} por $${grandTotal.toLocaleString('es-CL')}.`;
    sendAdminNotification(summaryNotif);

    // Redirigir a WhatsApp
    const waUrl = `https://wa.me/${bPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="public-portal-container">
      <header className="public-header glass-panel">
        <div className="public-header-brand">
          {businessConfig.logoUrl ? (
            <img src={businessConfig.logoUrl} alt="Logo" className="public-brand-logo" />
          ) : (
            <div className="public-brand-icon">
              <Home size={24} color={businessConfig.primaryColor || '#2c4c3b'} />
            </div>
          )}
          <div>
            <h1 className="public-brand-title">{businessConfig.businessName || 'Consultar Disponibilidad'}</h1>
            <p className="public-brand-subtitle">Consulta de Disponibilidad & Cotizador en Tiempo Real</p>
          </div>
        </div>

        <button className="btn-share-link" onClick={handleCopyLink} title="Copiar enlace de esta página">
          {copiedLink ? <Check size={16} color="var(--success)" /> : <Share2 size={16} />}
          <span>{copiedLink ? '¡Enlace Copiado!' : 'Compartir'}</span>
        </button>
      </header>

      <main className="public-content-grid">
        {/* PANEL IZQUIERDO: SELECCIÓN Y FORMULARIO */}
        <section className="public-card glass-panel">
          <h2 className="public-card-title">
            <Calendar size={22} color="var(--accent-primary)" /> 1. Fechas de Estadía y Pasajeros
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
            <Home size={22} color="var(--accent-primary)" /> 2. Selección de Cabaña / Alojamiento
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
            <Car size={22} color="var(--accent-primary)" /> 3. Arriendo de Vehículo (Opcional)
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
            <Sparkles size={22} color="var(--accent-primary)" /> Cotización Estimada
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
            onClick={handleSendWhatsApp}
            disabled={!activeCabinIsAvailable || (selectedCarId !== 'none' && !activeCarIsAvailable)}
          >
            <Send size={20} /> Solicitar Reserva por WhatsApp
          </button>

          {!activeCabinIsAvailable && (
            <p className="unavailable-warning">
              ⚠️ Selecciona fechas de cabaña con disponibilidad para enviar tu solicitud por WhatsApp.
            </p>
          )}

          {selectedCarId !== 'none' && !activeCarIsAvailable && (
            <p className="unavailable-warning">
              ⚠️ El vehículo seleccionado no está disponible en las fechas indicadas.
            </p>
          )}

          <div className="public-footer-guarantee">
            <ShieldCheck size={18} color="var(--success)" />
            <span>Garantía de respuesta rápida directamente con la administración.</span>
          </div>
        </section>
      </main>
    </div>
  );
}
