import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  isWithinInterval,
  startOfDay,
  isSameDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, MessageCircle, Compass, Users } from 'lucide-react';
import { useStore } from '../store/useStore';
import WhatsAppModal from '../components/WhatsAppModal';
import { parseSafeDate, formatSafeDate } from '../utils/dateUtils';
import './Calendar.css';

const TourCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [popover, setPopover] = useState({ visible: false, res: null, x: 0, y: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waReservation, setWaReservation] = useState(null);
  const [calculatedCost, setCalculatedCost] = useState(0);
  
  const [isTextCollapsed, setIsTextCollapsed] = useState(window.innerWidth < 768);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 768);

  const { tours, tourReservations, addTourReservation, updateTourReservation, deleteTourReservation } = useStore();
  
  const [resForm, setResForm] = useState({
    clientName: '', clientPhone: '', tourId: tours[0]?.id || '', date: '', time: '09:00', paxCount: 1, totalCost: 0, notes: ''
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const timelineStart = startOfMonth(subMonths(currentDate, 1));
  const timelineEnd = endOfMonth(addMonths(currentDate, 1));
  const daysInMonth = eachDayOfInterval({ start: timelineStart, end: timelineEnd });

  // Drag to Scroll State
  const gridRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleWrapperMouseDown = (e) => {
    if (!gridRef.current) return;
    setIsPanning(true);
    setStartX(e.pageX - gridRef.current.offsetLeft);
    setScrollLeft(gridRef.current.scrollLeft);
  };

  const handleWrapperMouseMove = (e) => {
    if (!isPanning) return;
    e.preventDefault();
    const x = e.pageX - gridRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    gridRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleWrapperMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  // Convert Vertical Scroll to Horizontal
  useEffect(() => {
    const handleWheel = (e) => {
      if (gridRef.current && e.deltaY !== 0) {
        e.preventDefault();
        gridRef.current.scrollLeft += e.deltaY;
      }
    };
    
    const el = gridRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, []);

  // Auto-scroll to first day of month
  useEffect(() => {
    if (gridRef.current) {
      const firstDay = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const element = document.getElementById(`tour-day-header-${firstDay}`);
      if (element) {
        gridRef.current.scrollTo({
          left: Math.max(0, element.offsetLeft - 220),
          behavior: 'smooth'
        });
      }
    }
  }, [currentDate]);

  // Auto-calculate Total Cost = price * paxCount (preservando precio manual)
  useEffect(() => {
    if (!resForm.tourId) return;
    const tour = tours.find(t => t.id === resForm.tourId);
    if (!tour) return;

    const suggested = (tour.price || 0) * (resForm.paxCount || 1);
    if (resForm.totalCost === 0 || resForm.totalCost === calculatedCost) {
      setResForm(prev => ({ ...prev, totalCost: suggested }));
    }
    setCalculatedCost(suggested);
  }, [resForm.tourId, resForm.paxCount, tours]);

  const getReservationsForDay = (tourId, day) => {
    const targetDateStr = formatSafeDate(day, 'yyyy-MM-dd');
    return tourReservations.filter(res => res.tourId === tourId && res.date === targetDateStr);
  };

  const handleResSubmit = (e) => {
    e.preventDefault();
    if (!resForm.tourId) {
      alert("Debe seleccionar un tour.");
      return;
    }

    addTourReservation(resForm);
    setIsModalOpen(false);
  };

  const openNewReservationForDay = (tourId, day) => {
    const tour = tours.find(t => t.id === tourId);
    const price = tour ? tour.price : 0;
    setResForm({
      clientName: '', 
      clientPhone: '', 
      tourId: tourId, 
      date: formatSafeDate(day, 'yyyy-MM-dd'), 
      time: '09:00',
      paxCount: 1, 
      totalCost: price, 
      notes: ''
    });
    setIsModalOpen(true);
  };

  return (
    <div className="card glass-panel calendar-page" style={{ userSelect: 'none' }}>
      <div className="calendar-header">
        <h1><Compass size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }}/> Calendario de Tours y Excursiones</h1>
        
        <div className="calendar-header-actions">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
              {isSidebarCollapsed ? 'Mostrar Tours' : 'Ocultar Tours'}
            </button>
            <button className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => setIsTextCollapsed(!isTextCollapsed)}>
              {isTextCollapsed ? 'Mostrar Textos' : 'Ocultar Textos'}
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => {
            const tour = tours[0];
            setResForm({
              clientName: '', clientPhone: '', tourId: tour?.id || '', date: formatSafeDate(new Date(), 'yyyy-MM-dd'), time: '09:00', paxCount: 1, totalCost: tour ? tour.price : 0, notes: ''
            });
            setIsModalOpen(true);
          }}>
            <Plus size={16} /> Agendar Tour
          </button>
          <div className="calendar-controls">
            <button className="btn-icon" onClick={prevMonth}>
              <ChevronLeft size={24} color="var(--text-primary)" />
            </button>
            <h2 className="current-month">
              {format(currentDate, 'MMMM yyyy', { locale: es }).toUpperCase()}
            </h2>
            <button className="btn-icon" onClick={nextMonth}>
              <ChevronRight size={24} color="var(--text-primary)" />
            </button>
          </div>
        </div>
      </div>

      <div 
        className="calendar-grid-wrapper"
        ref={gridRef}
        onMouseDown={handleWrapperMouseDown}
        onMouseMove={handleWrapperMouseMove}
        onMouseUp={handleWrapperMouseUpOrLeave}
        onMouseLeave={handleWrapperMouseUpOrLeave}
        style={{ cursor: isPanning ? 'grabbing' : 'auto' }}
      >
        <div className="calendar-grid">
          {/* Header Row */}
          <div className="calendar-row header-row">
            <div className={`calendar-cell cabin-name-header ${isSidebarCollapsed ? 'collapsed' : ''}`}>
              {isSidebarCollapsed ? 'Tour' : 'Tour / Excursión'}
            </div>
            {daysInMonth.map(day => {
              const isToday = isSameDay(day, new Date());
              return (
              <div key={day.toISOString()} id={`tour-day-header-${format(day, 'yyyy-MM-dd')}`} className={`calendar-cell day-header ${isToday ? 'today' : ''}`}>
                <span className="day-name">{format(day, 'E', { locale: es })}</span>
                <span className="day-number">{format(day, 'd')}</span>
              </div>
            )})}
          </div>

          {/* Tour Rows */}
          {tours.map(tour => (
            <div key={tour.id} className="calendar-row">
              <div className={`calendar-cell cabin-name-cell ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="cabin-color-dot" style={{ backgroundColor: tour.color || '#8e44ad' }}></div>
                {!isSidebarCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>{tour.name}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      ${Number(tour.price).toLocaleString('es-CL')}/pax
                    </span>
                  </div>
                )}
              </div>
              
              {daysInMonth.map(day => {
                const dayReservations = getReservationsForDay(tour.id, day);
                const isTodayCol = isSameDay(day, new Date());

                if (dayReservations.length === 0) {
                  return (
                    <div 
                      key={day.toISOString()} 
                      className={`calendar-cell day-cell free ${isTodayCol ? 'today-col' : ''}`}
                      onClick={() => openNewReservationForDay(tour.id, day)}
                      title="Haz clic para agendar un tour en este día"
                    ></div>
                  );
                }

                return (
                  <div 
                    key={day.toISOString()} 
                    className={`calendar-cell day-cell booked ${isTodayCol ? 'today-col' : ''}`}
                  >
                    {dayReservations.map((res) => {
                      const customStyle = { 
                        backgroundColor: tour.color || '#8e44ad', 
                        cursor: 'pointer',
                        borderRadius: '6px',
                        padding: '2px 6px'
                      };

                      return (
                        <div 
                          key={res.id}
                          className="reservation-bar start-day end-day"
                          style={customStyle}
                          onMouseEnter={(e) => {
                            clearTimeout(window.popoverTimeout);
                            const rect = e.currentTarget.getBoundingClientRect();
                            setPopover({ visible: true, res, x: e.clientX, y: rect.top - 10 });
                          }}
                          onMouseLeave={() => {
                            window.popoverTimeout = setTimeout(() => setPopover({ visible: false, res: null, x: 0, y: 0 }), 150);
                          }}
                        >
                          <span className="reservation-client" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                            {res.time || ''} {res.clientName} ({res.paxCount} Pax)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
          {tours.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No hay tours registrados. Ve a "Conf. Tours" para agregar opciones al catálogo.
            </div>
          )}
        </div>
      </div>

      {/* Popover Detalle */}
      {popover.visible && popover.res && createPortal(
        <div 
          className="calendar-popover glass-panel"
          style={{
            position: 'fixed',
            top: `${Math.max(10, popover.y - 100)}px`,
            left: `${popover.x}px`,
            transform: 'translateX(-50%)',
            zIndex: 999999,
            padding: '1rem',
            pointerEvents: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}
          onMouseEnter={() => { clearTimeout(window.popoverTimeout); setPopover(prev => ({ ...prev, visible: true })) }}
          onMouseLeave={() => { window.popoverTimeout = setTimeout(() => setPopover({ visible: false, res: null, x: 0, y: 0 }), 150) }}
        >
          <div style={{ fontWeight: 'bold', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{popover.res.clientName} ({popover.res.paxCount} Pax)</span>
            {popover.res.clientPhone && (
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setWaReservation(popover.res);
                  setWaModalOpen(true);
                  setPopover({ visible: false, res: null, x: 0, y: 0 });
                }}
                className="btn-icon"
                style={{ color: '#25D366', pointerEvents: 'auto', background: 'rgba(37,211,102,0.1)', padding: '4px', borderRadius: '4px' }} 
                title="Enviar WhatsApp"
              >
                <MessageCircle size={18} />
              </button>
            )}
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            📅 Fecha: {formatSafeDate(popover.res.date, 'dd MMM yyyy')}
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            ⏰ Hora: {popover.res.time || 'Por confirmar'}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--success)', marginTop: '0.25rem' }}>
            Total: ${Number(popover.res.totalCost).toLocaleString('es-CL')}
          </div>
          {popover.res.notes && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              📝 {popover.res.notes}
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Modal Agendar Tour */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Agendar Tour</h2>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleResSubmit}>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Cliente / Titular</label>
                  <input type="text" className="form-input" required value={resForm.clientName} onChange={e => setResForm({...resForm, clientName: e.target.value})} placeholder="Nombre completo" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Teléfono / WA</label>
                  <input type="text" className="form-input" placeholder="+569..." value={resForm.clientPhone} onChange={e => setResForm({...resForm, clientPhone: e.target.value})} />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Tour / Excursión</label>
                <select className="form-input" required value={resForm.tourId} onChange={e => setResForm({...resForm, tourId: e.target.value})}>
                  <option value="">Seleccione tour...</option>
                  {tours.map(t => <option key={t.id} value={t.id}>{t.name} - ${t.price}/pax ({t.duration})</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha del Tour</label>
                  <input type="date" className="form-input" required value={resForm.date} onChange={e => setResForm({...resForm, date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hora Salida</label>
                  <input type="time" className="form-input" required value={resForm.time} onChange={e => setResForm({...resForm, time: e.target.value})} />
                </div>
              </div>

              {resForm.date && resForm.date < new Date().toISOString().split('T')[0] && (
                <div style={{ marginBottom: '1rem', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'rgba(241, 196, 15, 0.15)', border: '1px solid rgba(241, 196, 15, 0.4)', color: '#b7950b', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📜 Modo Administrador: Registrando reserva de tour histórica (Fecha pasada)</span>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Cantidad de Pasajeros (Pax)</label>
                  <input type="number" min="1" className="form-input" required value={resForm.paxCount} onChange={e => setResForm({...resForm, paxCount: Number(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio Total Negociado ($)</label>
                  <input type="number" min="0" className="form-input" required value={resForm.totalCost} onChange={e => setResForm({...resForm, totalCost: Number(e.target.value)})} />
                  {resForm.tourId && (() => {
                    const tour = tours.find(t => t.id === resForm.tourId);
                    if (!tour) return null;
                    const isCustom = resForm.totalCost !== calculatedCost && calculatedCost > 0;
                    return (
                      <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.35rem' }}>
                        Tarifa de lista: {resForm.paxCount} Pax x ${tour.price.toLocaleString('es-CL')} = ${calculatedCost.toLocaleString('es-CL')}
                        {isCustom && (
                          <div style={{ marginTop: '4px', color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>🏷️ Descuento / Precio especial activo</span>
                            <button type="button" onClick={() => setResForm({...resForm, totalCost: calculatedCost})} className="btn btn-sm btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
                              Usar tarifa de lista
                            </button>
                          </div>
                        )}
                      </small>
                    );
                  })()}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notas / Observaciones</label>
                <input type="text" className="form-input" placeholder="Ej: Recoger en Cabaña 2..." value={resForm.notes} onChange={e => setResForm({...resForm, notes: e.target.value})} />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Reserva de Tour</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <WhatsAppModal 
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        reservation={waReservation}
        type="tour"
        contextName={waReservation ? tours.find(t => t.id === waReservation.tourId)?.name : ''}
      />
    </div>
  );
};

export default TourCalendar;
