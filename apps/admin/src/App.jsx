import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import CarCalendar from './pages/CarCalendar';
import TourCalendar from './pages/TourCalendar';
import Reservations from './pages/Reservations';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import AdminCars from './pages/AdminCars';
import AdminTours from './pages/AdminTours';
import QuoteGenerator from './pages/QuoteGenerator';
import PassengerRegistration from './pages/PassengerRegistration';
import SyncManager from './pages/SyncManager';
import Login from './pages/Login';
import Referrers from './pages/Referrers';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { fetchFromSupabase, initRealtimeSubscription, checkSession, processOfflineQueue, user } = useStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (!user) return;
    fetchFromSupabase();
    const unsubscribe = initRealtimeSubscription();

    const handleOnline = () => {
      console.log('Panel Admin en línea, procesando cola offline...');
      processOfflineQueue();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, [user, fetchFromSupabase, initRealtimeSubscription, processOfflineQueue]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Panel de Administración (Protegido) */}
        <Route path="/admin" element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="cars-calendar" element={<CarCalendar />} />
            <Route path="tours-calendar" element={<TourCalendar />} />
            <Route path="reservations" element={<Reservations />} />
            <Route path="reports" element={<Reports />} />
            <Route path="referrers" element={<Referrers />} />
            <Route path="settings" element={<Admin />} />
            <Route path="cars-settings" element={<AdminCars />} />
            <Route path="tours-settings" element={<AdminTours />} />
            <Route path="sync" element={<SyncManager />} />
            <Route path="tools/quote" element={<QuoteGenerator />} />
            <Route path="tools/passengers" element={<PassengerRegistration />} />
          </Route>
        </Route>

        {/* Raíz y fallback van directo al Panel Administrador */}
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
