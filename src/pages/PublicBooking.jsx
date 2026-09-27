import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Users, Search, Tent, CheckCircle2, Lock } from 'lucide-react';
import { addDays, isWithinInterval, startOfDay, isSameDay } from 'date-fns';
import { parseSafeDate, formatSafeDate } from '../utils/dateUtils';
import { useStore } from '../store/useStore';
import { calculateReservationCost } from '../utils/pricing';
import './PublicBooking.css';

const PublicBooking = () => {
  const navigate = useNavigate();
  const { cabins, reservations, prices } = useStore();
  
  const [startDate, setStartDate] = useState(formatSafeDate(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(formatSafeDate(addDays(new Date(), 3), 'yyyy-MM-dd'));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  
  const [searchResults, setSearchResults] = useState(null);

  const checkAvailability = (e) => {
    e.preventDefault();
    const start = startOfDay(parseSafeDate(startDate));
    const end = startOfDay(parseSafeDate(endDate));

    if (start >= end) {
      alert("La fecha de salida debe ser posterior a la fecha de llegada.");
      return;
    }

    const totalGuests = adults + children;
    
    const results = (cabins || []).map(cabin => {
      // Filtrar por capacidad
      if (cabin.maxCapacity < totalGuests) {
        return { cabin, available: false, reason: 'Capacidad excedida' };
      }

      // Buscar conflictos de reservas
      const hasConflict = (reservations || []).some(res => {
        if (res.cabinId !== cabin.id) return false;
        
        const resStart = startOfDay(parseSafeDate(res.startDate));
        const resEnd = startOfDay(parseSafeDate(res.endDate));
        
        // Un solapamiento ocurre si: 
        // start < resEnd AND end > resStart
        // Si entra el mismo día que otro sale (start == resEnd), NO es conflicto.
        return (start < resEnd && end > resStart);
      });

      if (hasConflict) {
        return { cabin, available: false, reason: 'Fechas no disponibles' };
      }

      // Está disponible, calculamos costo
      const cost = calculateReservationCost(startDate, endDate, adults, children, prices);
      return { cabin, available: true, cost };
    });

    // Agrupar cabañas por nombre base (removiendo números al final, ej: "Cabaña Mediana 1" -> "Cabaña Mediana")
    const groupedResults = [];
    
    results.forEach(res => {
      // Identificar el nombre base
      const baseName = res.cabin.name.replace(/\s\d+$/, '');
      const existingGroup = groupedResults.find(g => g.baseName === baseName);

      if (existingGroup) {
        if (res.available) {
          existingGroup.availableCount += 1;
          // Conservamos el id de la cabaña que sí está disponible para la reserva
          if (!existingGroup.availableCabinId) {
            existingGroup.availableCabinId = res.cabin.id;
          }
        }
      } else {
        groupedResults.push({
          baseName: baseName,
          cabin: res.cabin, // usamos los datos genéricos (maxCapacity) de la primera que encontramos
          cost: res.cost,
          availableCount: res.available ? 1 : 0,
          availableCabinId: res.available ? res.cabin.id : null,
          reason: res.reason
        });
      }
    });

    setSearchResults(groupedResults);
  };

  const handleBook = (cabinId) => {
    // Aquí en el futuro se enviaría a una pasarela de pago o formulario
    alert("Funcionalidad de reserva pública en construcción. \n\nPara integraciones futuras, aquí el usuario llenaría sus datos de pago.");
  };

  return (
    <div className="public-layout">
      {/* Navbar simplificado público */}
      <nav className="public-nav">
        <div className="nav-container">
          <div className="logo">
            <Tent size={32} />
            <h2>Cabañas Manuara</h2>
          </div>
          <button className="btn btn-outline admin-login-btn" onClick={() => navigate('/admin')}>
            <Lock size={18} /> Acceso Administrador
          </button>
        </div>
      </nav>

      <main className="public-main">
        <div className="hero-section text-center">
          <h1>Reserva tu Escape Ideal</h1>
          <p className="text-secondary">Conecta con la naturaleza en Cabañas Manuara.</p>
        </div>

        {/* Buscador de Disponibilidad */}
        <div className="search-widget glass-panel">
          <form onSubmit={checkAvailability} className="search-form">
            <div className="search-input-group">
              <label><CalendarIcon size={18} /> Llegada</label>
              <input 
                type="date" 
                className="form-input" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                required 
              />
            </div>
            
            <div className="search-input-group">
              <label><CalendarIcon size={18} /> Salida</label>
              <input 
                type="date" 
                className="form-input" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                required 
              />
            </div>

            <div className="search-input-group">
              <label><Users size={18} /> Húespedes</label>
              <div className="guest-selector">
                <select className="form-input" value={adults} onChange={e => setAdults(Number(e.target.value))}>
                  {[1,2,3,4,5,6].map(n => <option key={`a${n}`} value={n}>{n} {n === 1 ? 'Adulto' : 'Adultos'}</option>)}
                </select>
                <select className="form-input" value={children} onChange={e => setChildren(Number(e.target.value))}>
                  <option value={0}>0 Niños</option>
                  {[1,2,3,4].map(n => <option key={`n${n}`} value={n}>{n} {n === 1 ? 'Niño' : 'Niños'}</option>)}
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-primary search-btn">
              <Search size={20} /> Buscar
            </button>
          </form>
        </div>

        {/* Resultados */}
        {searchResults && (
          <div className="results-section">
            <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              Resultados del {formatSafeDate(startDate, "d 'de' MMMM")} al {formatSafeDate(endDate, "d 'de' MMMM")}
            </h3>
            
            <div className="cars-grid">
              {searchResults.map((result, idx) => (
                <div key={idx} className={`cabin-card glass-panel ${result.availableCount === 0 ? 'unavailable' : ''}`}>
                  <div className="cabin-img-placeholder">
                    <Tent size={48} color="rgba(0,0,0,0.1)" />
                  </div>
                  <div className="cabin-info">
                    <h4>{result.baseName}</h4>
                    <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                      Capacidad Máxima: {result.cabin.maxCapacity} personas
                    </p>

                    {result.availableCount > 0 ? (
                      <div className="pricing-box">
                        <div style={{ background: 'rgba(85, 107, 47, 0.1)', color: '#556B2F', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-block', marginBottom: '0.5rem' }}>
                          {result.availableCount} {result.availableCount === 1 ? 'unidad disponible' : 'unidades disponibles'}
                        </div>
                        <div className="cost">
                          <span className="amount">${result.cost.toLocaleString('es-CL')}</span>
                          <span className="total-label">Total Estadía</span>
                        </div>
                        <button className="btn btn-primary" onClick={() => handleBook(result.availableCabinId)}>
                          <CheckCircle2 size={18} /> Reservar Ahora
                        </button>
                      </div>
                    ) : (
                      <div className="unavailable-box">
                        <span className="reason">{result.reason || 'Sin unidades'}</span>
                        <button className="btn btn-outline" disabled>No Disponible</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicBooking;
