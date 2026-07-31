import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Compass, BookOpen, BarChart3, Car, Settings, Calculator, Users, RefreshCw, WifiOff, CloudOff, Palette, Share2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { FEATURES } from '../config/features';
import './Sidebar.css';

const Sidebar = ({ onClose }) => {
  const { offlineQueue, businessConfig } = useStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const allMenuItems = [
    { path: '/admin/dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20} />, enabled: true },
    { path: '/admin/calendar', name: 'Cal. Cabañas', icon: <CalendarDays size={20} />, enabled: true },
    { path: '/admin/cars-calendar', name: 'Cal. Vehículos', icon: <Car size={20} />, enabled: true },
    { path: '/admin/tours-calendar', name: 'Cal. Tours', icon: <Compass size={20} />, enabled: true },
    { path: '/admin/reservations', name: 'Reservas Cabañas', icon: <BookOpen size={20} />, enabled: true },
    { path: '/admin/reports', name: 'Reportes', icon: <BarChart3 size={20} />, enabled: true },
    { path: '/admin/cars-settings', name: 'Flota Vehículos', icon: <Settings size={20} />, enabled: true },
    { path: '/admin/tours-settings', name: 'Conf. Tours', icon: <Settings size={20} />, enabled: true },
    { path: '/admin/settings', name: 'Personalización', icon: <Palette size={20} />, enabled: true },
    { path: '/admin/tools/quote', name: 'Cotizador', icon: <Calculator size={20} />, enabled: FEATURES.showQuote },
    { path: '/admin/tools/passengers', name: 'Pasajeros', icon: <Users size={20} />, enabled: FEATURES.showPassengers },
    { path: '/disponibilidad', name: 'Portal Público', icon: <Share2 size={20} />, enabled: true },
    { path: '/admin/sync', name: 'Sincronización', icon: <RefreshCw size={20} />, enabled: true },
  ];

  const menuItems = allMenuItems.filter(item => item.enabled);

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        {businessConfig?.logoUrl ? (
          <img 
            src={businessConfig.logoUrl} 
            alt="Logo" 
            style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: '8px', flexShrink: 0 }} 
          />
        ) : (
          <Car className="logo-icon" size={28} style={{ color: businessConfig?.primaryColor || 'var(--accent-primary)' }} />
        )}
        <h2 style={{ fontSize: '1.1rem', wordBreak: 'break-word', margin: 0 }}>
          {businessConfig?.businessName || 'Mi Administración'}
        </h2>
      </div>
      
      {!isOnline && (
        <div style={{ margin: '0.5rem 1rem', padding: '0.5rem', background: 'rgba(231, 76, 60, 0.1)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
          <WifiOff size={16} /> Modo Sin Conexión
        </div>
      )}
      {offlineQueue.length > 0 && (
        <div style={{ margin: '0.5rem 1rem', padding: '0.5rem', background: 'rgba(243, 156, 18, 0.1)', color: '#d35400', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
          <CloudOff size={16} /> {offlineQueue.length} cambio(s) por subir
        </div>
      )}

      <nav className="sidebar-nav">
        <div className="sidebar-scrollable" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
          {menuItems.map((item) => (
            <NavLink 
              key={item.path} 
              to={item.path} 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              {item.icon}
              <span>{item.name}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
