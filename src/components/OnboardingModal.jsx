import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Sparkles, Building2, UserCheck, Palette, CheckCircle2, ChevronRight, ChevronLeft, Plus, Trash2, Home } from 'lucide-react';
import './OnboardingModal.css';

const THEME_PRESETS = [
  { id: 'green', name: 'Verde Bosque', color: '#2c4c3b' },
  { id: 'blue', name: 'Azul Océano', color: '#1e3a8a' },
  { id: 'terracotta', name: 'Terracota', color: '#d35400' },
  { id: 'purple', name: 'Morado Elegante', color: '#6b21a8' },
  { id: 'teal', name: 'Turquesa Marino', color: '#0d9488' },
  { id: 'slate', name: 'Gris Grafito', color: '#334155' }
];

export default function OnboardingModal() {
  const { businessConfig, updateBusinessConfig, cabins, addCabin, updateCabin, deleteCabin } = useStore();
  const [step, setStep] = useState(1);

  // Form State
  const [businessName, setBusinessName] = useState(businessConfig.businessName || 'Cabañas El Paraíso');
  const [administratorName, setAdministratorName] = useState(businessConfig.administratorName || 'Administrador General');
  const [contactPhone, setContactPhone] = useState(businessConfig.contactPhone || '');
  const [contactEmail, setContactEmail] = useState(businessConfig.contactEmail || '');
  const [primaryColor, setPrimaryColor] = useState(businessConfig.primaryColor || '#2c4c3b');

  // Local cabins state for fast editing during onboarding
  const [localCabins, setLocalCabins] = useState(cabins.length > 0 ? cabins : [
    { id: '1', name: 'Cabaña Grande', maxCapacity: 6, color: '#D35400' },
    { id: '2', name: 'Cabaña Pequeña', maxCapacity: 3, color: '#556B2F' },
    { id: '3', name: 'Cabaña Mediana 1', maxCapacity: 4, color: '#B8860B' }
  ]);

  const handleCabinChange = (id, field, value) => {
    setLocalCabins(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleAddCabin = () => {
    const newId = Date.now().toString();
    setLocalCabins(prev => [...prev, {
      id: newId,
      name: `Cabaña ${prev.length + 1}`,
      maxCapacity: 4,
      color: '#2980b9'
    }]);
  };

  const handleRemoveCabin = (id) => {
    if (localCabins.length <= 1) {
      alert("Debes mantener al menos una cabaña en el sistema.");
      return;
    }
    setLocalCabins(prev => prev.filter(c => c.id !== id));
  };

  const handleFinish = () => {
    // 1. Update business config & mark setup completed
    updateBusinessConfig({
      businessName: businessName.trim() || 'Mi Complejo de Cabañas',
      administratorName: administratorName.trim() || 'Administrador',
      contactPhone: contactPhone.trim(),
      contactEmail: contactEmail.trim(),
      primaryColor,
      isSetupCompleted: true
    });

    // 2. Sync cabins to store
    localCabins.forEach(cab => {
      const exists = cabins.find(c => c.id === cab.id);
      if (exists) {
        updateCabin(cab.id, { name: cab.name, maxCapacity: cab.maxCapacity, color: cab.color });
      } else {
        addCabin({ name: cab.name, maxCapacity: cab.maxCapacity, color: cab.color, type: 'standard' });
      }
    });

    // Remove deleted cabins if any
    cabins.forEach(c => {
      if (!localCabins.find(lc => lc.id === c.id)) {
        deleteCabin(c.id);
      }
    });
  };

  if (businessConfig.isSetupCompleted) return null;

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <h1><Sparkles size={24} color={primaryColor} /> Bienvenido a tu Administrador</h1>
          <p>Personaliza la información inicial de tu propiedad y cabañas para comenzar.</p>
        </div>

        {/* Wizard Steps Indicator */}
        <div className="onboarding-steps">
          <div className={`step-indicator ${step >= 1 ? (step === 1 ? 'active' : 'completed') : ''}`}>
            {step > 1 ? <CheckCircle2 size={20} /> : '1'}
            <span className="step-label">Identidad</span>
          </div>
          <div className={`step-indicator ${step >= 2 ? (step === 2 ? 'active' : 'completed') : ''}`}>
            {step > 2 ? <CheckCircle2 size={20} /> : '2'}
            <span className="step-label">Cabañas</span>
          </div>
          <div className={`step-indicator ${step >= 3 ? 'active' : ''}`}>
            '3'
            <span className="step-label">Apariencia</span>
          </div>
        </div>

        {/* Step 1: Business Identity */}
        {step === 1 && (
          <div className="step-content">
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#1e293b' }}>
              <Building2 size={18} style={{ display: 'inline', marginRight: 6 }} /> Datos del Establecimiento
            </h3>
            
            <div className="form-group">
              <label className="form-label">Nombre del Complejo / Cabañas</label>
              <input 
                type="text" 
                className="form-input" 
                value={businessName} 
                onChange={e => setBusinessName(e.target.value)}
                placeholder="Ej: Cabañas Los Alerces" 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">¿Quién Administra?</label>
              <input 
                type="text" 
                className="form-input" 
                value={administratorName} 
                onChange={e => setAdministratorName(e.target.value)}
                placeholder="Ej: María González / Administración" 
                required 
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Teléfono de Contacto (Opcional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={contactPhone} 
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="+56 9 1234 5678" 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email de Contacto (Opcional)</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={contactEmail} 
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="contacto@cabanas.cl" 
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Cabins Configuration */}
        {step === 2 && (
          <div className="step-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>
                <Home size={18} style={{ display: 'inline', marginRight: 6 }} /> Configuración Inicial de Cabañas
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={handleAddCabin}>
                <Plus size={16} /> Agregar Cabaña
              </button>
            </div>
            
            <p className="text-secondary" style={{ margin: 0, fontSize: '0.85rem' }}>
              Define los nombres, capacidad y el color distintivo con el que verás cada cabaña en los calendarios.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto' }}>
              {localCabins.map(cabin => (
                <div key={cabin.id} className="cabin-setup-row">
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ padding: '6px 10px', fontSize: '0.9rem' }}
                    value={cabin.name} 
                    onChange={e => handleCabinChange(cabin.id, 'name', e.target.value)}
                    placeholder="Nombre Cabaña" 
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      type="number" 
                      min="1" 
                      className="form-input" 
                      style={{ padding: '6px 10px', fontSize: '0.9rem' }}
                      value={cabin.maxCapacity} 
                      onChange={e => handleCabinChange(cabin.id, 'maxCapacity', Number(e.target.value))}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Pax</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input 
                      type="color" 
                      className="form-input" 
                      style={{ padding: '2px', height: '34px', width: '40px', cursor: 'pointer' }}
                      value={cabin.color || '#2980b9'} 
                      onChange={e => handleCabinChange(cabin.id, 'color', e.target.value)}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Color</span>
                  </div>
                  <button className="btn-icon danger" onClick={() => handleRemoveCabin(cabin.id)} title="Eliminar cabaña">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Theme & Visual Style */}
        {step === 3 && (
          <div className="step-content">
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>
              <Palette size={18} style={{ display: 'inline', marginRight: 6 }} /> Personaliza el Tema de la Aplicación
            </h3>
            <p className="text-secondary" style={{ margin: 0, fontSize: '0.85rem' }}>
              Selecciona el color principal que identificará tu marca y panel de administración.
            </p>

            <div className="color-picker-grid">
              {THEME_PRESETS.map(theme => (
                <div 
                  key={theme.id}
                  className={`color-option-card ${primaryColor === theme.color ? 'selected' : ''}`}
                  onClick={() => setPrimaryColor(theme.color)}
                >
                  <div className="color-swatch" style={{ backgroundColor: theme.color }}></div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155' }}>{theme.name}</span>
                </div>
              ))}
            </div>

            {/* Live Preview Card */}
            <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '12px', background: '#f8fafc', border: `2px solid ${primaryColor}` }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vista Previa de Marca</span>
              <h2 style={{ color: primaryColor, margin: '0.25rem 0' }}>{businessName || 'Mi Complejo de Cabañas'}</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>Administrado por: <strong>{administratorName || 'Administrador'}</strong></p>
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="onboarding-footer">
          {step > 1 ? (
            <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={18} /> Anterior
            </button>
          ) : (
            <div></div>
          )}

          {step < 3 ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
              Siguiente <ChevronRight size={18} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleFinish} style={{ background: primaryColor }}>
              <CheckCircle2 size={18} /> Guardar y Comenzar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
