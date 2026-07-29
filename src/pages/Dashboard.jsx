import { useStore } from '../store/useStore';
import { startOfMonth, endOfMonth, isWithinInterval, isAfter, startOfDay, addDays } from 'date-fns';
import { Tent, Users, DollarSign, Calendar as CalIcon } from 'lucide-react';
import { parseSafeDate, formatSafeDate } from '../utils/dateUtils';
import './Dashboard.css';

const Dashboard = () => {
  const { reservations, cabins } = useStore();
  const now = new Date();
  
  const activeReservations = reservations.filter(r => r.status !== 'archived');

  const currentMonthReservations = activeReservations.filter(res => {
    const start = parseSafeDate(res.startDate);
    return isWithinInterval(start, { start: startOfMonth(now), end: endOfMonth(now) });
  });

  const monthIncome = currentMonthReservations.reduce((acc, res) => acc + Number(res.totalCost), 0);
  
  const upcomingReservations = [...reservations]
    .filter(res => {
       const safe = parseSafeDate(res.startDate);
       return isAfter(safe, now) || safe.toDateString() === now.toDateString();
    })
    .sort((a, b) => parseSafeDate(a.startDate) - parseSafeDate(b.startDate))
    .slice(0, 5);

  const today = startOfDay(now);

  const arrivingToday = activeReservations.filter(res => {
    if (res.status === 'blocked') return false;
    const start = startOfDay(parseSafeDate(res.startDate));
    return start.getTime() === today.getTime();
  });

  const arrivingFuture = activeReservations.filter(res => {
    if (res.status === 'blocked') return false;
    const start = startOfDay(parseSafeDate(res.startDate));
    return start > today && start <= addDays(today, 7);
  });

  const leavingSoon = activeReservations.filter(res => {
    if (res.status === 'blocked') return false;
    const end = startOfDay(parseSafeDate(res.endDate));
    return end >= today && end <= addDays(today, 3);
  });

  const currentlyOccupied = activeReservations.filter(res => {
    if (res.status === 'blocked') return false;
    const start = startOfDay(parseSafeDate(res.startDate));
    const end = startOfDay(parseSafeDate(res.endDate));
    return start <= today && end > today;
  });

  return (
    <div className="dashboard-page">
      <h1>Dashboard Operativo</h1>
      
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid var(--accent-secondary)' }}>
          <div className="stat-info">
            <span className="stat-label">Actuales en Cabaña</span>
            <h2 className="stat-value">{currentlyOccupied.length}</h2>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-info">
            <span className="stat-label">Check-ins Hoy</span>
            <h2 className="stat-value">{arrivingToday.length}</h2>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-info">
            <span className="stat-label">Próximos OUT (3 días)</span>
            <h2 className="stat-value">{leavingSoon.length}</h2>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon"><CalIcon size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Reservas este Mes</span>
            <h2 className="stat-value">{currentMonthReservations.length}</h2>
          </div>
        </div>
      </div>

      <div className="dashboard-content" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
        {/* Arrivals Today */}
        <div className="card glass-panel upcoming-section">
          <h2 style={{ color: 'var(--success)' }}>Llegadas HOY</h2>
          {arrivingToday.length === 0 ? (
            <p className="empty-text">No hay llegadas programadas para hoy.</p>
          ) : (
            <div className="upcoming-list">
              {arrivingToday.map(res => {
                const cabin = cabins.find(c => c.id === res.cabinId);
                const totalPax = (Number(res.adults)||0) + (Number(res.childrenCount)||0) + (Number(res.babiesCount)||0);
                return (
                  <div key={res.id} className="upcoming-item" style={{ borderLeftColor: 'var(--success)', background: 'rgba(46, 204, 113, 0.1)' }}>
                    <div className="upcoming-details">
                      <strong>{res.clientName}</strong>
                      <span>🏠 {cabin?.name}</span>
                    </div>
                    <div className="upcoming-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <Users size={12} style={{ display: 'inline', marginRight: 4 }}/>
                        {totalPax} Pax
                      </span>
                      {res.flightIn && (
                        <span style={{ color: 'var(--accent-secondary)' }}>
                           🛬 Vuelo: {res.flightIn}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Arrivals Future */}
        <div className="card glass-panel upcoming-section">
          <h2 style={{ color: 'var(--success)' }}>Llegadas Próximas</h2>
          {arrivingFuture.length === 0 ? (
            <p className="empty-text">No hay llegadas en los próximos 7 días.</p>
          ) : (
            <div className="upcoming-list">
              {arrivingFuture.map(res => {
                const cabin = cabins.find(c => c.id === res.cabinId);
                const totalPax = (Number(res.adults)||0) + (Number(res.childrenCount)||0) + (Number(res.babiesCount)||0);
                return (
                  <div key={res.id} className="upcoming-item" style={{ borderLeftColor: 'var(--success)' }}>
                    <div className="upcoming-details">
                      <strong>{res.clientName}</strong>
                      <span>🏠 {cabin?.name}</span>
                    </div>
                    <div className="upcoming-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <Users size={12} style={{ display: 'inline', marginRight: 4 }}/>
                        {totalPax} Pax
                      </span>
                      {res.flightIn && (
                        <span style={{ color: 'var(--accent-secondary)' }}>
                           🛬 Vuelo: {res.flightIn}
                        </span>
                      )}
                    </div>
                    <div className="upcoming-date" style={{ marginLeft: '1rem', minWidth: '75px', textAlign: 'right' }}>
                      {formatSafeDate(res.startDate, 'dd MMM')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Departures Section */}
        <div className="card glass-panel upcoming-section">
          <h2 style={{ color: 'var(--danger)' }}>Salidas Próximas (Check-outs)</h2>
          {leavingSoon.length === 0 ? (
            <p className="empty-text">No hay salidas en los próximos 3 días.</p>
          ) : (
            <div className="upcoming-list">
              {leavingSoon.map(res => {
                const cabin = cabins.find(c => c.id === res.cabinId);
                const totalPax = (Number(res.adults)||0) + (Number(res.childrenCount)||0) + (Number(res.babiesCount)||0);
                return (
                  <div key={res.id} className="upcoming-item" style={{ borderLeftColor: 'var(--danger)' }}>
                    <div className="upcoming-details">
                      <strong>{res.clientName}</strong>
                      <span>🏠 {cabin?.name}</span>
                    </div>
                    <div className="upcoming-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <Users size={12} style={{ display: 'inline', marginRight: 4 }}/>
                        {totalPax} Pax
                      </span>
                      {res.flightOut && (
                        <span style={{ color: 'var(--accent-secondary)' }}>
                           🛫 Vuelo: {res.flightOut}
                        </span>
                      )}
                    </div>
                    <div className="upcoming-date" style={{ marginLeft: '1rem', minWidth: '75px', textAlign: 'right' }}>
                      {formatSafeDate(res.endDate, 'dd MMM')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
