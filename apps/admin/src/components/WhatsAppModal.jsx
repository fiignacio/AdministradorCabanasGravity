import { useState, useEffect } from 'react';
import { X, MessageCircle, RefreshCw } from 'lucide-react';
import { generateWhatsAppLink, generateCarMessage, generateTourMessage } from '../utils/whatsapp';
import { useStore } from '../store/useStore';

const WhatsAppModal = ({ isOpen, onClose, reservation, type, contextName }) => {
  const { businessConfig } = useStore();
  const [template, setTemplate] = useState('confirmation');
  const [message, setMessage] = useState('');

  const bName = businessConfig?.businessName || 'nuestra administración';

  useEffect(() => {
    if (isOpen && reservation) {
      if (type === 'tour') {
        setMessage(generateTourMessage(reservation, contextName, template, bName));
      } else {
        setMessage(generateCarMessage(reservation, contextName, template, bName));
      }
    }
  }, [isOpen, reservation, template, type, contextName, bName]);

  if (!isOpen || !reservation) return null;

  const handleSend = () => {
    const link = generateWhatsAppLink(reservation.clientPhone, message);
    window.open(link, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleRefresh = () => {
    if (type === 'tour') {
      setMessage(generateTourMessage(reservation, contextName, template, bName));
    } else {
      setMessage(generateCarMessage(reservation, contextName, template, bName));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <MessageCircle size={24} color="#25D366" /> 
            Enviar WhatsApp
          </h2>
          <button className="btn-icon" onClick={onClose}><X size={24} /></button>
        </div>

        <div style={{ marginBottom: '1.5rem', background: 'rgba(37, 211, 102, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(37, 211, 102, 0.2)' }}>
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', margin: 0 }}>
              Destinatario: <strong>{reservation.clientName} ({reservation.clientPhone || 'Sin número registrado'})</strong>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Elegir Plantilla de Notificación</label>
          <select 
            className="form-input" 
            value={template} 
            onChange={(e) => setTemplate(e.target.value)}
          >
            {type === 'tour' ? (
              <>
                <option value="confirmation">Confirmación de Reserva de Tour</option>
                <option value="reminder">🔔 Recordatorio de Próximo Tour (Fecha, Hora & Recomendaciones)</option>
                <option value="payment">💰 Cobro de Saldo Pendiente</option>
              </>
            ) : (
              <>
                <option value="confirmation">Confirmación de Arriendo de Vehículo</option>
                <option value="checkin">🚗 Recordatorio de Retiro / Entrega de Vehículo</option>
                <option value="checkout">🏁 Recordatorio de Devolución de Vehículo</option>
                <option value="payment">💰 Cobro de Saldo Pendiente</option>
              </>
            )}
          </select>
        </div>

        <div className="form-group" style={{ position: 'relative' }}>
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Mensaje a enviar
            <button 
              className="btn-icon" 
              style={{ padding: '4px' }} 
              title="Restaurar texto original de la plantilla"
              onClick={handleRefresh}
            >
              <RefreshCw size={14} />
            </button>
          </label>
          <textarea 
            className="form-input" 
            rows={9} 
            value={message} 
            onChange={(e) => setMessage(e.target.value)}
            style={{ fontFamily: 'inherit', resize: 'vertical' }}
          />
          <small className="text-secondary" style={{ display: 'block', marginTop: '0.5rem' }}>
            Puedes editar este texto libremente antes de enviarlo por WhatsApp.
          </small>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button 
            type="button" 
            className="btn btn-primary" 
            style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={handleSend}
          >
            <MessageCircle size={18} />
            Abrir WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppModal;
