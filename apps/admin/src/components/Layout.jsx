import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import OnboardingModal from './OnboardingModal';
import AdminNotifications from './AdminNotifications';
import { useStore } from '../store/useStore';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { businessConfig } = useStore();

  useEffect(() => {
    if (businessConfig?.primaryColor) {
      document.documentElement.style.setProperty('--accent-primary', businessConfig.primaryColor);
      document.documentElement.style.setProperty('--primary-color', businessConfig.primaryColor);
    }
  }, [businessConfig?.primaryColor]);

  return (
    <div className="app-container">
      {/* Onboarding Wizard popup for first launch */}
      <OnboardingModal />

      {/* Mobile Top Bar */}
      <div className="mobile-topbar glass-panel" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn-icon" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} color="var(--text-primary)" />
          </button>
          <h2 style={{ fontSize: '1rem', margin: 0, color: 'var(--text-primary)' }}>
            {businessConfig?.businessName || 'Panel de Administración'}
          </h2>
        </div>

        {/* Admin Notifications Bell on Mobile Header */}
        <AdminNotifications />
      </div>

      {/* Overlay para cerrar haciendo tap afuera */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>

      <div className={`sidebar-container ${sidebarOpen ? 'open' : ''}`}>
        <button className="mobile-close-btn btn-icon" onClick={() => setSidebarOpen(false)}>
          <X size={24} color="var(--text-primary)" />
        </button>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="main-content">
        {/* Desktop Header bar with Notification Bell */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1rem' }} className="desktop-header-bar">
          <AdminNotifications />
        </div>

        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
