import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { usePublicStore } from './store/usePublicStore';
import PublicAvailability from './pages/PublicAvailability';

function App() {
  const { fetchPublicData, initRealtimeSubscription, businessConfig } = usePublicStore();

  useEffect(() => {
    fetchPublicData();
    const unsubscribe = initRealtimeSubscription();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchPublicData, initRealtimeSubscription]);

  useEffect(() => {
    if (businessConfig?.primaryColor) {
      document.documentElement.style.setProperty('--accent-primary', businessConfig.primaryColor);
      document.documentElement.style.setProperty('--primary-color', businessConfig.primaryColor);
    }
    if (businessConfig?.businessName) {
      document.title = `${businessConfig.businessName} | Alojamiento & Rent a Car en Rapa Nui`;
    }
  }, [businessConfig?.primaryColor, businessConfig?.businessName]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<PublicAvailability />} />
        <Route path="/disponibilidad" element={<PublicAvailability />} />
        <Route path="/consultar" element={<PublicAvailability />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
