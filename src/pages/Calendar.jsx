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
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { parseSafeDate, formatSafeDate } from '../utils/dateUtils';
import ReservationModal from '../components/ReservationModal';
import './Calendar.css';

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [popover, setPopover] = useState({ visible: false, res: null, x: 0, y: 0 });
  const { cabins, reservations, updateReservation } = useStore();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRes, setEditingRes] = useState(null);
  const [initialDataForModal, setInitialDataForModal] = useState(null);

  const [dragCreate, setDragCreate] = useState({ active: false, cabinId: null, startDay: null, endDay: null });
  const [isTextCollapsed, setIsTextCollapsed] = useState(window.innerWidth < 768);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 768);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const timelineStart = startOfMonth(subMonths(currentDate, 1));
  const timelineEnd = endOfMonth(addMonths(currentDate, 1));
  const daysInMonth = eachDayOfInterval({ start: timelineStart, end: timelineEnd }); // Reutilizamos el nombre de la variable para no romper el resto del código

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
      const element = document.getElementById(`day-header-${firstDay}`);
      if (element) {
        // Descontamos 220px del sticky header de las cabañas para que quede justo al borde visible
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
          setDragCreate({ active: false, cabinId: null, startDay: null, endDay: null });
          return;
        }

        setEditingRes(null);
        setInitialDataForModal({
          cabinId: dragCreate.cabinId,
          startDate: formatSafeDate(start, 'yyyy-MM-dd'),
          endDate: formatSafeDate(end, 'yyyy-MM-dd')
        });
        setIsModalOpen(true);
        setDragCreate({ active: false, cabinId: null, startDay: null, endDay: null });
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragCreate]);

  const getReservationsForDay = (cabinId, day) => {
    return reservations.filter(res => res.status !== 'archived').filter(res => {
      if (res.cabinId !== cabinId) return false;
      const start = startOfDay(parseSafeDate(res.startDate));
      const end = startOfDay(parseSafeDate(res.endDate));
      const current = startOfDay(day);
      return isWithinInterval(current, { start, end });
    });
  };

  // Drag and Drop para Mover Reservas
  const handleDragStart = (e, resId) => {
    e.dataTransfer.setData('resId', resId);
    setPopover({ visible: false, res: null, x: 0, y: 0 }); // Ocultar popover al arrastrar
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Permitir el drop
  };

  const handleDrop = (e, targetCabinId, targetDay) => {
    e.preventDefault();
    const resId = e.dataTransfer.getData('resId');
    if (!resId) return;

    const newStart = startOfDay(targetDay);
    const today = startOfDay(new Date());
    
    if (newStart < today) {
      alert("No se puede mover la reserva a una fecha pasada.");
      return;
    }

    const res = reservations.find(r => r.id === resId);
    if (!res) return;

    const start = parseSafeDate(res.startDate);
    const end = parseSafeDate(res.endDate);
    const durationMs = end.getTime() - start.getTime();

    const newEnd = new Date(newStart.getTime() + durationMs);

    // Validar superposición (simplificada para evitar arrastrar sobre reservas existentes)
    const isOverlapping = reservations.some(existingRes => {
      if (existingRes.id === resId || existingRes.cabinId !== targetCabinId) return false;
      const exStart = parseSafeDate(existingRes.startDate);
      const exEnd = parseSafeDate(existingRes.endDate);
      return (newStart < exEnd && newEnd > exStart);
    });

    if (isOverlapping) {
      alert("No se puede mover aquí. Ya existe una reserva en estas fechas.");
      return;
    }

    const isAdjacent = reservations.some(existingRes => {
      if (existingRes.id === resId || existingRes.cabinId !== targetCabinId) return false;
      const exStart = parseSafeDate(existingRes.startDate);
      const exEnd = parseSafeDate(existingRes.endDate);
      return newStart.getTime() === exEnd.getTime() || newEnd.getTime() === exStart.getTime();
    });

    if (isAdjacent) {
      if (!window.confirm("⚠️ Atención: La fecha seleccionada coincide con la llegada o salida de otra reserva en esta cabaña. ¿Mover de todos modos?")) return;
    }

    updateReservation(resId, {
      cabinId: targetCabinId,
      startDate: formatSafeDate(newStart, 'yyyy-MM-dd'),
      endDate: formatSafeDate(newEnd, 'yyyy-MM-dd')
    });
  };

  // Swipe-to-Select Logic
  const handleMouseDown = (e, cabinId, day) => {
    e.stopPropagation(); // Evitar que inicie el paneo (Drag to Scroll)
    setDragCreate({ active: true, cabinId, startDay: day, endDay: day });
  };

  const handleMouseEnter = (cabinId, day) => {
    if (dragCreate.active && dragCreate.cabinId === cabinId) {
      setDragCreate(prev => ({ ...prev, endDay: day }));
    }
  };

  return (
    <div className="card glass-panel calendar-page" style={{ userSelect: 'none' }}>
      <div className="calendar-header">
        <h1>Calendario de Disponibilidad</h1>
        
        <div className="calendar-header-actions">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
              {isSidebarCollapsed ? 'Mostrar Cabañas' : 'Ocultar Cabañas'}
            </button>
            <button className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => setIsTextCollapsed(!isTextCollapsed)}>
              {isTextCollapsed ? 'Mostrar Textos' : 'Ocultar Textos'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => {
              setEditingRes(null);
              setInitialDataForModal(null);
              setIsModalOpen(true);
            }}>
              <Plus size={16} /> Crear Reserva
            </button>
          </div>
          
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
        style={{ cursor: isPanning ? 'grabbing' : 'auto', isolation: 'isolate' }}
      >
        <div className="calendar-grid">
          {/* Header Row */}
          <div className="calendar-row header-row">
            <div className={`calendar-cell cabin-name-header ${isSidebarCollapsed ? 'collapsed' : ''}`}>
              {isSidebarCollapsed ? 'Cab.' : 'Cabaña'}
            </div>
            {daysInMonth.map(day => {
              const isToday = isSameDay(day, new Date());
              return (
              <div key={day.toISOString()} id={`day-header-${format(day, 'yyyy-MM-dd')}`} className={`calendar-cell day-header ${isToday ? 'today' : ''}`}>
                <span className="day-name">{format(day, 'E', { locale: es })}</span>
                <span className="day-number">{format(day, 'd')}</span>
              </div>
            )})}
          </div>

          {/* Cabin Rows */}
          {cabins.map(cabin => (
            <div key={cabin.id} className="calendar-row">
              <div className={`calendar-cell cabin-name-cell ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="cabin-color-dot" style={{ backgroundColor: cabin.color || 'var(--accent-primary)' }}></div>
                {!isSidebarCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>{cabin.name}</strong>
                  </div>
                )}
              </div>
              
              {daysInMonth.map(day => {
                const dayReservations = getReservationsForDay(cabin.id, day);
                const currentDay = startOfDay(day);
                
                // Determinar si esta celda está siendo "dibujada" por el Swipe-to-Select
                let isBeingDragged = false;
                if (dragCreate.active && dragCreate.cabinId === cabin.id) {
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
                      onMouseDown={(e) => handleMouseDown(e, cabin.id, day)}
                      onMouseEnter={() => handleMouseEnter(cabin.id, day)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, cabin.id, day)}
                      style={isBeingDragged ? { backgroundColor: 'rgba(59, 130, 246, 0.2)' } : {}}
                    ></div>
                  );
                }

                return (
                  <div 
                    key={day.toISOString()} 
                    className={`calendar-cell day-cell booked ${isTodayCol ? 'today-col' : ''}`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, cabin.id, day)}
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
                        : { backgroundColor: cabin.color || 'var(--accent-primary)', cursor: 'pointer' };

                      if (dayReservations.length > 1) {
                         if (isEnd) {
                             barClasses += ' end-day half-left';
                             customStyle.zIndex = 2;
                         } else if (isStart) {
                             barClasses += ' start-day half-right';
                             customStyle.zIndex = 3;
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
                          onMouseDown={(e) => e.stopPropagation()} // Evitar paneo al interactuar con reservas
                          onClick={() => {
                            if (dragCreate.active) return;
                            setPopover({ visible: false, res: null, x: 0, y: 0 });
                            setEditingRes(res);
                            setIsModalOpen(true);
                          }}
                          onDragStart={(e) => handleDragStart(e, res.id)}
                          onMouseEnter={(e) => {
                            if (dragCreate.active) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            setPopover({ visible: true, res, x: e.clientX, y: rect.top - 10 });
                          }}
                          onMouseLeave={() => setPopover({ visible: false, res: null, x: 0, y: 0 })}
                        >
                          {isStart && !isBlock && (
                            <span 
                              className="reservation-client" 
                              style={{ 
                                flexShrink: 0, 
                                maxWidth: isTextCollapsed ? '50px' : `calc(${nights} * 42px - 16px)`, 
                                display: 'inline-block', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                verticalAlign: 'middle',
                                paddingLeft: '2px'
                              }}
                            >
                              {res.clientName} ({Number(res.adults || 0) + Number(res.childrenCount || 0) + Number(res.babiesCount || 0)} pax)
                            </span>
                          )}
                          {isStart && isBlock && <span className="reservation-client" style={{ flexShrink: 0, maxWidth: `calc(${nights} * 42px - 16px)`, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle', color: '#fff' }}>Bloqueado</span>}
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
            top: `${Math.max(10, popover.y - 130)}px`,
            left: `${popover.x}px`,
            transform: 'translateX(-50%)',
            zIndex: 999999,
            padding: '1rem',
            pointerEvents: 'none',
            minWidth: '200px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}
        >
          <div style={{ fontWeight: 'bold', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            {popover.res.status === 'blocked' ? 'Bloqueo / Mantenimiento' : popover.res.clientName}
          </div>
          {!popover.res.status || popover.res.status !== 'blocked' ? (
            <>
              <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Llegada: {formatSafeDate(popover.res.startDate, 'dd MMM yyyy')}
              </div>
              <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Salida: {formatSafeDate(popover.res.endDate, 'dd MMM yyyy')}
              </div>
              <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Huéspedes: {Number(popover.res.adults) + Number(popover.res.childrenCount) + Number(popover.res.babiesCount)} pers.
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--success)' }}>
                Total: ${Number(popover.res.totalCost).toLocaleString('es-CL')}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.85rem' }}>No disponible para reservas.</div>
          )}
        </div>,
        document.body
      )}

      {/* Modal Nueva Reserva/Edición Reutilizado */}
      <ReservationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        reservationToEdit={editingRes}
        initialData={initialDataForModal}
      />
    </div>
  );
};

export default Calendar;
