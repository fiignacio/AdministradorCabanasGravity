import { useState } from 'react';
import { Bell, MessageCircle, X, CheckCircle2, Globe } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatSafeDate, parseSafeDate } from '../utils/dateUtils';
import WhatsAppModal from './WhatsAppModal';
import { isToday, isTomorrow } from 'date-fns';

export default function AdminNotifications() {
  const {
    carReservations,
    cars,
    tourReservations,
    tours,
    adminNotifications,
    markNotificationRead,
    markAllNotificationsRead
  } = useStore();
  const [isOpen, setIsOpen] = useState(false);

  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waReservation, setWaReservation] = useState(null);
  const [waType, setWaType] = useState('car');
  const [waContextName, setWaContextName] = useState('');

  const unreadWebNotifications = (adminNotifications || []).filter((n) => !n.read);

  // Entregas o devoluciones de vehículos para hoy o mañana
  const upcomingCars = carReservations.filter((res) => {
    if (!res.startDate || !res.endDate) return false;
    const start = parseSafeDate(res.startDate);
    const end = parseSafeDate(res.endDate);
    return isToday(start) || isTomorrow(start) || isToday(end) || isTomorrow(end);
  });

  // Salidas de tours para hoy o mañana
  const upcomingTours = tourReservations.filter((res) => {
    if (!res.date) return false;
    const date = parseSafeDate(res.date);
    return isToday(date) || isTomorrow(date);
  });

  const totalAlerts = unreadWebNotifications.length + upcomingCars.length + upcomingTours.length;

  const openWhatsApp = (res, type, contextName) => {
    setWaReservation(res);
    setWaType(type);
    setWaContextName(contextName);
    setWaModalOpen(true);
    setIsOpen(false);
  };

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button
          className="btn-icon"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: 'relative',
            background: isOpen ? 'rgba(0,0,0,0.06)' : 'transparent',
            padding: '8px',
            borderRadius: '50%'
          }}
          title="Avisos y Notificaciones Web para el Administrador"
        >
          <Bell size={22} color={totalAlerts > 0 ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
          {totalAlerts > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                background: '#ef4444',
                color: '#ffffff',
                borderRadius: '999px',
                padding: '2px 6px',
                fontSize: '0.7rem',
                fontWeight: '800',
                boxShadow: '0 0 0 2px #ffffff'
              }}
            >
              {totalAlerts}
            </span>
          )}
        </button>

        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '48px',
              right: 0,
              width: '380px',
              maxHeight: '520px',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
              zIndex: 99999,
              padding: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} color="var(--accent-primary)" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>Avisos del Día (Admin)</h3>
              </div>
              <button className="btn-icon" onClick={() => setIsOpen(false)} style={{ padding: '2px' }}>
                <X size={18} />
              </button>
            </div>

            {/* BOTÓN DE NOTIFICACIONES NATIVAS CON SONIDO Y VIBRACIÓN MÓVIL */}
            <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)', padding: '0.75rem 1rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid #fcd34d' }}>
              <div style={{ fontSize: '0.8rem', color: '#78350F', fontWeight: '700', marginBottom: '0.4rem' }}>
                📲 Notificaciones Nativas Móvil & Web
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={async () => {
                    const { requestNotificationPermission, sendNativeNotification } = await import('../utils/notifications');
                    const granted = await requestNotificationPermission();
                    if (granted) {
                      sendNativeNotification('🔔 Notificaciones Activadas', '¡Sonido, vibración y banners nativos activados correctamente!');
                    }
                  }}
                  style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.75rem', fontWeight: '700', background: '#8C5A32', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Activar Permiso 📲
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const { sendNativeNotification } = await import('../utils/notifications');
                    sendNativeNotification('🔔 Prueba de Sonido y Vibración', 'Cabañas Manuara: Dispositivo vibrando y sonando.');
                  }}
                  style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.75rem', fontWeight: '700', background: '#ffffff', color: '#78350F', border: '1px solid #d97706', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Probar Vibra/Sonido 🔔
                </button>
              </div>
            </div>

            {totalAlerts === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#64748b', fontSize: '0.9rem' }}>
                <CheckCircle2 size={32} color="#22c55e" style={{ margin: '0 auto 0.5rem auto' }} />
                <span>¡Sin avisos pendientes para hoy ni mañana!</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* 🌐 Solicitudes nuevas recibidas desde el Sitio Web Público */}
                {unreadWebNotifications.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Globe size={13} /> Solicitudes Web ({unreadWebNotifications.length})
                      </span>
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Marcar todas leídas
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {unreadWebNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          style={{
                            background: '#fffbeb',
                            padding: '0.75rem',
                            borderRadius: '10px',
                            border: '1px solid #fde68a',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '0.5rem'
                          }}
                        >
                          <div style={{ fontSize: '0.8rem', color: '#1e293b' }}>
                            <strong style={{ display: 'block', color: '#92400e', marginBottom: '2px' }}>{notif.title}</strong>
                            <span>{notif.message}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => markNotificationRead(notif.id)}
                            title="Marcar como leída"
                            style={{ background: '#ffffff', border: '1px solid #fcd34d', borderRadius: '6px', padding: '3px 7px', fontSize: '0.7rem', fontWeight: 600, color: '#92400e', cursor: 'pointer', flexShrink: 0 }}
                          >
                            OK
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 🚗 Entregas de Vehículos */}
                {upcomingCars.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      🚗 Arriendos (Entregas / Devoluciones)
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {upcomingCars.map((res) => {
                        const car = cars.find((c) => c.id === res.carId);
                        const isStartToday = isToday(parseSafeDate(res.startDate));
                        return (
                          <div key={res.id} style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '0.88rem', color: '#0f172a', display: 'block' }}>{res.clientName}</strong>
                              <span style={{ fontSize: '0.78rem', color: '#475569' }}>{car ? car.name : 'Vehículo'} ({car ? car.plate : ''})</span>
                              <div style={{ fontSize: '0.72rem', color: isStartToday ? '#2563eb' : '#64748b', fontWeight: '600', marginTop: '2px' }}>
                                {isStartToday ? '⚡ Retiro HOY' : '📅 Retiro Mañana'} ({formatSafeDate(res.startDate, 'dd/MM')})
                              </div>
                            </div>
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: '#25D366', borderColor: '#25D366' }}
                              onClick={() => openWhatsApp(res, 'car', car ? car.name : 'Vehículo')}
                              title="Enviar aviso WhatsApp"
                            >
                              <MessageCircle size={14} /> WhatsApp
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 🧭 Próximos Tours */}
                {upcomingTours.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#8e44ad', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      🧭 Tours y Excursiones Próximas
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {upcomingTours.map((res) => {
                        const tour = tours.find((t) => t.id === res.tourId);
                        const isTourToday = isToday(parseSafeDate(res.date));
                        return (
                          <div key={res.id} style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '0.88rem', color: '#0f172a', display: 'block' }}>{res.clientName} ({res.paxCount} Pax)</strong>
                              <span style={{ fontSize: '0.78rem', color: '#475569' }}>{tour ? tour.name : 'Tour'}</span>
                              <div style={{ fontSize: '0.72rem', color: isTourToday ? '#9333ea' : '#64748b', fontWeight: '600', marginTop: '2px' }}>
                                {isTourToday ? '⚡ Salida HOY' : '📅 Salida Mañana'} a las {res.time || '09:00'}
                              </div>
                            </div>
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: '#25D366', borderColor: '#25D366' }}
                              onClick={() => openWhatsApp(res, 'tour', tour ? tour.name : 'Tour')}
                              title="Enviar aviso WhatsApp"
                            >
                              <MessageCircle size={14} /> WhatsApp
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <WhatsAppModal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        reservation={waReservation}
        type={waType}
        contextName={waContextName}
      />
    </>
  );
}
