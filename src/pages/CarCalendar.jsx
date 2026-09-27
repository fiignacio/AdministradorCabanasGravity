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
import { ChevronLeft, ChevronRight, Plus, X, MessageCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import WhatsAppModal from '../components/WhatsAppModal';
import { parseSafeDate, formatSafeDate } from '../utils/dateUtils';
import './Calendar.css';

const CarCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [popover, setPopover] = useState({ visible: false, res: null, x: 0, y: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waReservation, setWaReservation] = useState(null);
  const [calculatedCost, setCalculatedCost] = useState(0);
  
  const [isTextCollapsed, setIsTextCollapsed] = useState(window.innerWidth < 768);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 768);

  const { cars, carReservations, addCarReservation, updateCarReservation } = useStore();
  
  const [resForm, setResForm] = useState({
    clientName: '', clientPhone: '', carId: cars[0]?.id || '', startDate: '', endDate: '', status: 'confirmed', totalCost: 0
  });

  // Swipe-to-Select (Drag to Create) State
  const [dragCreate, setDragCreate] = useState({ active: false, carId: null, startDay: null, endDay: null });

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

  // Convertir Scroll Vertical (Rueda del Ratón) a Horizontal
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

  // Auto-scroll al primer día del mes cuando cambia currentDate o se carga el componente
  useEffect(() => {
    if (gridRef.current) {
      const firstDay = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const element = document.getElementById(`day-header-car-${firstDay}`);
      if (element) {
        gridRef.current.scrollTo({
          left: Math.max(0, element.offsetLeft - 220),
          behavior: 'smooth'
        });
      }
    }
  }, [currentDate]);

  // Detener Swipe-to-Select si el ratón se levanta fuera
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragCreate.active) {
        let start = dragCreate.startDay;
        let end = dragCreate.endDay;
        if (start > end) {
          start = dragCreate.endDay;
          end = dragCreate.startDay;
        }

        const today = startOfDay(new Date());
        if (start < today) {
          alert("No se pueden crear reservas en el pasado.");
          setDragCreate({ active: false, carId: null, startDay: null, endDay: null });
          return;
        }

        setResForm({
          clientName: '', clientPhone: '', carId: dragCreate.carId, 
          startDate: formatSafeDate(start, 'yyyy-MM-dd'), 
          endDate: formatSafeDate(end, 'yyyy-MM-dd'), 
          status: 'confirmed', totalCost: 0
        });
        setIsModalOpen(true);
        setDragCreate({ active: false, carId: null, startDay: null, endDay: null });
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragCreate]);

  // Auto-calcular costo preservando precio manual si fue modificado
  useEffect(() => {
    if (!resForm.carId || !resForm.startDate || !resForm.endDate) return;
    
    const start = parseSafeDate(resForm.startDate);
    const end = parseSafeDate(resForm.endDate);
    
    if (start > end) return;
    
    const diffTime = Math.abs(end - start);
    const days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    const car = cars.find(c => c.id === resForm.carId);
    if (!car) return;

    let rate = car.dailyRate;
    if (car.promoThresholdDays > 0 && days >= car.promoThresholdDays) {
      rate = car.promoDailyRate;
    }
    
    const suggested = rate * days;
    if (resForm.totalCost === 0 || resForm.totalCost === calculatedCost) {
      setResForm(prev => ({ ...prev, totalCost: suggested }));
    }
    setCalculatedCost(suggested);
  }, [resForm.carId, resForm.startDate, resForm.endDate, cars]);

  const getReservationsForDay = (carId, day) => {
    return carReservations.filter(res => {
      if (res.carId !== carId) return false;
      const start = startOfDay(parseSafeDate(res.startDate));
      const end = startOfDay(parseSafeDate(res.endDate));
      const current = startOfDay(day);
      return isWithinInterval(current, { start, end });
    });
  };

  const handleResSubmit = (e) => {
    e.preventDefault();
    if (!resForm.carId) {
      alert("Debe seleccionar un vehículo.");
      return;
    }
    
    const start = parseSafeDate(resForm.startDate);
    const end = parseSafeDate(resForm.endDate);
    
    const isOverlapping = carReservations.some(existingRes => {
      if (existingRes.carId !== resForm.carId) return false;
      const exStart = parseSafeDate(existingRes.startDate);
      const exEnd = parseSafeDate(existingRes.endDate);
      return (start < exEnd && end > exStart);
    });

    if (isOverlapping) {
      alert("El vehículo ya está reservado en esas fechas.");
      return;
    }

    const isAdjacent = carReservations.some(existingRes => {
      if (existingRes.carId !== resForm.carId) return false;
      const exStart = parseSafeDate(existingRes.startDate);
      const exEnd = parseSafeDate(existingRes.endDate);
      return start.getTime() === exEnd.getTime() || end.getTime() === exStart.getTime();
    });

    if (isAdjacent) {
      const confirmSave = window.confirm('⚠️ Atención: Has seleccionado una fecha que coincide con la devolución o retiro de otro cliente en el mismo vehículo. ¿Estás seguro de agendarlo en esta fecha?');
      if (!confirmSave) return;
    }

    addCarReservation(resForm);
    setIsModalOpen(false);
  };

  // Drag and Drop para Mover Reservas
  const handleDragStart = (e, resId) => {
    e.dataTransfer.setData('resId', resId);
    setPopover({ visible: false, res: null, x: 0, y: 0 }); 
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetCarId, targetDay) => {
    e.preventDefault();
    const resId = e.dataTransfer.getData('resId');
    if (!resId) return;

    const newStart = startOfDay(targetDay);
    const today = startOfDay(new Date());
    
    if (newStart < today) {
      alert("No se puede mover la reserva a una fecha pasada.");
      return;
    }

    const res = carReservations.find(r => r.id === resId);
    if (!res) return;

    const start = parseSafeDate(res.startDate);
    const end = parseSafeDate(res.endDate);
    const durationMs = end.getTime() - start.getTime();

    const newEnd = new Date(newStart.getTime() + durationMs);

    const isOverlapping = carReservations.some(existingRes => {
      if (existingRes.id === resId || existingRes.carId !== targetCarId) return false;
      const exStart = parseSafeDate(existingRes.startDate);
      const exEnd = parseSafeDate(existingRes.endDate);
      return (newStart < exEnd && newEnd > exStart);
    });

    if (isOverlapping) {
      alert("No se puede mover aquí. El vehículo ya está reservado.");
      return;
    }

    const isAdjacent = carReservations.some(existingRes => {
      if (existingRes.id === resId || existingRes.carId !== targetCarId) return false;
      const exStart = parseSafeDate(existingRes.startDate);
      const exEnd = parseSafeDate(existingRes.endDate);
      return newStart.getTime() === exEnd.getTime() || newEnd.getTime() === exStart.getTime();
    });

    if (isAdjacent) {
      if (!window.confirm("⚠️ Atención: La fecha seleccionada coincide con la devolución o retiro de otro cliente. ¿Mover de todos modos?")) return;
    }

    updateCarReservation(resId, {
      carId: targetCarId,
      startDate: formatSafeDate(newStart, 'yyyy-MM-dd'),
      endDate: formatSafeDate(newEnd, 'yyyy-MM-dd')
    });
  };

  // Swipe-to-Select Logic
  const handleMouseDown = (e, carId, day) => {
    e.stopPropagation(); // Evitar que inicie el paneo (Drag to Scroll)
    setDragCreate({ active: true, carId, startDay: day, endDay: day });
  };

  const handleMouseEnter = (carId, day) => {
    if (dragCreate.active && dragCreate.carId === carId) {
      setDragCreate(prev => ({ ...prev, endDay: day }));
    }
  };

  return (
    <div className="card glass-panel calendar-page" style={{ userSelect: 'none' }}>
      <div className="calendar-header">
        <h1>Calendario de Vehículos</h1>
        
        <div className="calendar-header-actions">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
              {isSidebarCollapsed ? 'Mostrar Autos' : 'Ocultar Autos'}
            </button>
            <button className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => setIsTextCollapsed(!isTextCollapsed)}>
              {isTextCollapsed ? 'Mostrar Textos' : 'Ocultar Textos'}
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => {
            setResForm({
              clientName: '', clientPhone: '', carId: cars[0]?.id || '', startDate: '', endDate: '', status: 'confirmed', totalCost: 0
            });
            setIsModalOpen(true);
          }}>
            <Plus size={16} /> Nueva Reserva
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
              {isSidebarCollapsed ? 'Veh.' : 'Vehículo'}
            </div>
            {daysInMonth.map(day => {
              const isToday = isSameDay(day, new Date());
              return (
              <div key={day.toISOString()} id={`car-day-header-${format(day, 'yyyy-MM-dd')}`} className={`calendar-cell day-header ${isToday ? 'today' : ''}`}>
                <span className="day-name">{format(day, 'E', { locale: es })}</span>
                <span className="day-number">{format(day, 'd')}</span>
              </div>
            )})}
          </div>

          {/* Car Rows */}
          {cars.map(car => (
            <div key={car.id} className="calendar-row">
              <div className={`calendar-cell cabin-name-cell ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="cabin-color-dot" style={{ backgroundColor: car.color || 'var(--accent-secondary)' }}></div>
                {!isSidebarCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>{car.brand} {car.model}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{car.plate}</span>
                  </div>
                )}
              </div>
              
              {daysInMonth.map(day => {
                const dayReservations = getReservationsForDay(car.id, day);
                const currentDay = startOfDay(day);
                
                let isBeingDragged = false;
                if (dragCreate.active && dragCreate.carId === car.id) {
                  let start = dragCreate.startDay;
                  let end = dragCreate.endDay;
                  if (start > end) { start = dragCreate.endDay; end = dragCreate.startDay; }
                  if (currentDay >= start && currentDay <= end) isBeingDragged = true;
                }
                
                const isTodayCol = isSameDay(day, new Date());

                if (dayReservations.length === 0) {
                  return (
                    <div 
                      key={day.toISOString()} 
                      className={`calendar-cell day-cell free ${isTodayCol ? 'today-col' : ''}`}
                      onMouseDown={(e) => handleMouseDown(e, car.id, day)}
                      onMouseEnter={() => handleMouseEnter(car.id, day)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, car.id, day)}
                      style={isBeingDragged ? { backgroundColor: 'rgba(59, 130, 246, 0.2)' } : {}}
                    ></div>
                  );
                }

                return (
                  <div 
                    key={day.toISOString()} 
                    className={`calendar-cell day-cell booked ${isTodayCol ? 'today-col' : ''}`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, car.id, day)}
                  >
                    {dayReservations.map((res, index) => {
                      const isBlock = res.status === 'blocked';
                      const resStart = startOfDay(parseSafeDate(res.startDate));
                      const resEnd = startOfDay(parseSafeDate(res.endDate));
                      const isStart = isSameDay(resStart, currentDay);
                      const isEnd = isSameDay(resEnd, currentDay);
                      const nights = Math.max(1, Math.ceil(Math.abs(resEnd - resStart) / (1000 * 60 * 60 * 24)));

                      let barClasses = `reservation-bar ${isBlock ? 'blocked' : ''}`;
                      let customStyle = isBlock 
                        ? { background: 'linear-gradient(135deg, #706258, #3E312A)', cursor: 'pointer' } 
                        : { backgroundColor: car.color || 'var(--accent-primary)', cursor: 'pointer' };

                      if (dayReservations.length > 1) {
                         if (isEnd) {
                             barClasses += ' end-day';
                             customStyle.zIndex = 2;
                             customStyle.right = '50%';
                             customStyle.borderTopRightRadius = '999px';
                             customStyle.borderBottomRightRadius = '999px';
                         } else if (isStart) {
                             barClasses += ' start-day';
                             customStyle.zIndex = 3;
                             customStyle.left = '50%';
                             customStyle.borderTopLeftRadius = '999px';
                             customStyle.borderBottomLeftRadius = '999px';
                         }
                      } else {
                         if (isStart) barClasses += ' start-day';
                         if (isEnd) barClasses += ' end-day';
                      }

                      return (
                        <div 
                          key={res.id}
                          className={barClasses}
                          style={customStyle}
                          draggable={true}
                          onMouseDown={(e) => e.stopPropagation()}
                          onDragStart={(e) => handleDragStart(e, res.id)}
                          onMouseEnter={(e) => {
                            if (dragCreate.active) return;
                            clearTimeout(window.popoverTimeout);
                            const rect = e.currentTarget.getBoundingClientRect();
                            setPopover({ visible: true, res, x: e.clientX, y: rect.top - 10 });
                          }}
                          onMouseLeave={() => {
                            window.popoverTimeout = setTimeout(() => setPopover({ visible: false, res: null, x: 0, y: 0 }), 150);
                          }}
                        >
                          {isStart && !isBlock && (
                            <span className="reservation-client" style={{ 
                              flexShrink: 0, 
                              maxWidth: isTextCollapsed ? '16px' : `calc(${nights} * 42px - 16px)`, 
                              display: 'inline-block', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              verticalAlign: 'middle',
                              transition: 'max-width 0.3s ease'
                            }}>
                              {res.clientName}
                            </span>
                          )}
                          {isStart && isBlock && <span className="reservation-client" style={{ flexShrink: 0, maxWidth: isTextCollapsed ? '16px' : `calc(${nights} * 42px - 16px)`, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle', color: '#fff', transition: 'max-width 0.3s ease' }}>Bloqueado</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

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
            <span>{popover.res.clientName}</span>
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
            Retiro: {formatSafeDate(popover.res.startDate, 'dd MMM yyyy')}
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            Devolución: {formatSafeDate(popover.res.endDate, 'dd MMM yyyy')}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--success)', marginTop: '0.25rem' }}>
            Total: ${Number(popover.res.totalCost).toLocaleString('es-CL')}
          </div>
        </div>,
        document.body
      )}

      {/* Modal Nueva Reserva */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Arrendar Vehículo</h2>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleResSubmit}>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Cliente</label>
                  <input type="text" className="form-input" required value={resForm.clientName} onChange={e => setResForm({...resForm, clientName: e.target.value})} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label" title="Opcional">Teléfono / WhatsApp</label>
                  <input type="text" className="form-input" placeholder="+569..." value={resForm.clientPhone} onChange={e => setResForm({...resForm, clientPhone: e.target.value})} />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Vehículo</label>
                <select className="form-input" required value={resForm.carId} onChange={e => setResForm({...resForm, carId: e.target.value})}>
                  <option value="">Seleccione vehículo...</option>
                  {cars.map(c => <option key={c.id} value={c.id}>{c.name} ({c.plate}) - ${c.dailyRate}/día</option>)}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha Retiro</label>
                  <input type="date" className="form-input" required value={resForm.startDate} onChange={e => setResForm({...resForm, startDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha Devolución</label>
                  <input type="date" className="form-input" required value={resForm.endDate} onChange={e => setResForm({...resForm, endDate: e.target.value})} />
                </div>
              </div>

              {resForm.startDate && resForm.startDate < new Date().toISOString().split('T')[0] && (
                <div style={{ marginBottom: '1rem', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'rgba(241, 196, 15, 0.15)', border: '1px solid rgba(241, 196, 15, 0.4)', color: '#b7950b', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📜 Modo Administrador: Registrando arriendo histórico (Fecha pasada)</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Precio Total Negociado ($)</label>
                <input type="number" className="form-input" required value={resForm.totalCost} onChange={e => setResForm({...resForm, totalCost: Number(e.target.value)})} />
                
                {resForm.carId && resForm.startDate && resForm.endDate && (() => {
                  const s = parseSafeDate(resForm.startDate);
                  const e = parseSafeDate(resForm.endDate);
                  if (s > e) return null;
                  const d = Math.max(1, Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)));
                  const c = cars.find(car => car.id === resForm.carId);
                  if (!c) return null;
                  const isPromo = c.promoThresholdDays > 0 && d >= c.promoThresholdDays;
                  const isCustom = resForm.totalCost !== calculatedCost && calculatedCost > 0;
                  return (
                    <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.35rem' }}>
                      Cálculo de lista: {d} días x ${isPromo ? c.promoDailyRate.toLocaleString('es-CL') : c.dailyRate.toLocaleString('es-CL')} = ${calculatedCost.toLocaleString('es-CL')}
                      {isPromo && ' (Tarifa Promo)'}
                      {isCustom && (
                        <div style={{ marginTop: '4px', color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🏷️ Tarifa manual / descuento activo</span>
                          <button type="button" onClick={() => setResForm({...resForm, totalCost: calculatedCost})} className="btn btn-sm btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
                            Usar tarifa de lista
                          </button>
                        </div>
                      )}
                    </small>
                  );
                })()}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Arriendo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <WhatsAppModal 
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        reservation={waReservation}
        type="car"
        contextName={waReservation ? cars.find(c => c.id === waReservation.carId)?.name : ''}
      />
    </div>
  );
};

export default CarCalendar;
