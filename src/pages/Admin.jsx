import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Settings, Save, Building2, Palette, RefreshCw, Upload, Image as ImageIcon, Trash2, Plus, Edit2, X } from 'lucide-react';
import './Admin.css';

const THEME_PRESETS = [
  { id: 'green', name: 'Verde Bosque', color: '#2c4c3b' },
  { id: 'blue', name: 'Azul Océano', color: '#1e3a8a' },
  { id: 'terracotta', name: 'Terracota', color: '#d35400' },
  { id: 'purple', name: 'Morado Elegante', color: '#6b21a8' },
  { id: 'teal', name: 'Turquesa Marino', color: '#0d9488' },
  { id: 'slate', name: 'Gris Grafito', color: '#334155' }
];

const Admin = () => {
  const { 
    prices, updatePrices, 
    cabins, addCabin, updateCabin, deleteCabin,
    businessConfig, updateBusinessConfig, resetSetup 
  } = useStore();
  
  // Branding Form State
  const [brandForm, setBrandForm] = useState({
    businessName: businessConfig.businessName || '',
    administratorName: businessConfig.administratorName || '',
    contactPhone: businessConfig.contactPhone || '',
    contactEmail: businessConfig.contactEmail || '',
    primaryColor: businessConfig.primaryColor || '#2c4c3b',
    logoUrl: businessConfig.logoUrl || ''
  });
  const [brandSaved, setBrandSaved] = useState(false);

  // Prices Form State
  const [pricesForm, setPricesForm] = useState({
    highSeasonAdult: prices.highSeasonAdult,
    lowSeasonAdult: prices.lowSeasonAdult,
    child: prices.child
  });
  const [priceSaved, setPriceSaved] = useState(false);

  // Cabin Form State
  const [isCabinModalOpen, setIsCabinModalOpen] = useState(false);
  const [editingCabin, setEditingCabin] = useState(null);
  const [cabinForm, setCabinForm] = useState({ name: '', type: 'large', maxCapacity: 4, color: '#2980b9' });

  const handleBrandSubmit = (e) => {
    e.preventDefault();
    updateBusinessConfig(brandForm);
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 3000);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen del logo no debe superar los 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setBrandForm(prev => ({ ...prev, logoUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handlePriceChange = (e) => {
    setPricesForm({ ...pricesForm, [e.target.name]: Number(e.target.value) });
    setPriceSaved(false);
  };

  const handleSavePrices = (e) => {
    e.preventDefault();
    updatePrices(pricesForm);
    setPriceSaved(true);
    setTimeout(() => setPriceSaved(false), 3000);
  };

  const openNewCabin = () => {
    setCabinForm({ name: '', type: 'large', maxCapacity: 4, color: '#2980b9' });
    setEditingCabin(null);
    setIsCabinModalOpen(true);
  };

  const openEditCabin = (cabin) => {
    setCabinForm({ name: cabin.name, type: cabin.type || 'large', maxCapacity: cabin.maxCapacity, color: cabin.color || '#2980b9' });
    setEditingCabin(cabin);
    setIsCabinModalOpen(true);
  };

  const handleDeleteCabin = (id) => {
    if (window.confirm('¿Eliminar esta cabaña? (Se perderá del catálogo)')) {
      deleteCabin(id);
    }
  };

  const handleCabinSubmit = (e) => {
    e.preventDefault();
    if (editingCabin) {
      updateCabin(editingCabin.id, cabinForm);
    } else {
      addCabin(cabinForm);
    }
    setIsCabinModalOpen(false);
  };

  return (
    <div className="admin-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1><Settings size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Panel de Configuración Completo</h1>
          <p className="text-secondary">Personaliza el logo, nombre de tu negocio, catálogo de cabañas, tarifas y paleta de colores.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => { resetSetup(); window.location.reload(); }}>
          <RefreshCw size={18} /> Re-iniciar Asistente Inicial
        </button>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        {/* 1. Panel de Identidad y Marca */}
        <div className="card glass-panel admin-section" style={{ gridColumn: 'span 1' }}>
          <h2><Building2 size={22} style={{ display: 'inline', marginRight: 8, color: brandForm.primaryColor }} /> Marca y Administración</h2>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Sube tu logo institucional y personaliza los datos corporativos.</p>
          
          <form onSubmit={handleBrandSubmit} className="prices-form">
            <div className="form-group">
              <label className="form-label"><ImageIcon size={16} style={{ display: 'inline', marginRight: 6 }} /> Logo de la Empresa</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '6px' }}>
                {brandForm.logoUrl ? (
                  <div style={{ position: 'relative', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '6px', background: '#ffffff', display: 'inline-block' }}>
                    <img src={brandForm.logoUrl} alt="Logo Preview" style={{ height: 50, maxWidth: 120, objectFit: 'contain', display: 'block' }} />
                    <button 
                      type="button" 
                      onClick={() => setBrandForm({...brandForm, logoUrl: ''})}
                      style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Eliminar Logo"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '0.88rem' }}>
                    <Upload size={16} /> Subir Imagen del Logo (PNG, JPG, SVG)
                    <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nombre del Negocio / Empresa</label>
              <input 
                type="text" 
                className="form-input" 
                value={brandForm.businessName} 
                onChange={e => setBrandForm({...brandForm, businessName: e.target.value})} 
                placeholder="Ej: Mi Complejo & Turismo"
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">¿Quién Administra? (Propietario / Admin)</label>
              <input 
                type="text" 
                className="form-input" 
                value={brandForm.administratorName} 
                onChange={e => setBrandForm({...brandForm, administratorName: e.target.value})} 
                placeholder="Ej: Juan Pérez / Administración"
                required 
              />
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Teléfono de Contacto</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={brandForm.contactPhone} 
                  onChange={e => setBrandForm({...brandForm, contactPhone: e.target.value})} 
                  placeholder="+56 9..." 
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Email de Contacto</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={brandForm.contactEmail} 
                  onChange={e => setBrandForm({...brandForm, contactEmail: e.target.value})} 
                  placeholder="contacto@empresa.cl" 
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label"><Palette size={16} style={{ display: 'inline', marginRight: 6 }} /> Color de Tema Principal</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'center' }}>
                {THEME_PRESETS.map(preset => (
                  <div 
                    key={preset.id} 
                    onClick={() => setBrandForm({...brandForm, primaryColor: preset.color})}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', backgroundColor: preset.color, cursor: 'pointer',
                      border: brandForm.primaryColor === preset.color ? '3px solid #0f172a' : '2px solid transparent',
                      boxShadow: brandForm.primaryColor === preset.color ? '0 0 0 3px #ffffff' : '0 2px 5px rgba(0,0,0,0.1)'
                    }}
                    title={preset.name}
                  />
                ))}
                <input 
                  type="color" 
                  value={brandForm.primaryColor} 
                  onChange={e => setBrandForm({...brandForm, primaryColor: e.target.value})}
                  style={{ width: 38, height: 32, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                  title="Color personalizado"
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ backgroundColor: brandForm.primaryColor }}>
                <Save size={18} /> Guardar Personalización
              </button>
              {brandSaved && <span className="text-success save-msg">¡Marca y logo actualizados!</span>}
            </div>
          </form>
        </div>

        {/* 2. Tarifas Globales por Temporada de Cabañas */}
        <div className="card glass-panel admin-section">
          <h2>Tarifas Globales por Temporada (Cabañas)</h2>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Valores por noche utilizados para el cálculo automático de estadía en cabañas.</p>
          
          <form onSubmit={handleSavePrices} className="prices-form">
            <div className="form-group">
              <label className="form-label">Adulto Temporada Alta ($)</label>
              <input type="number" name="highSeasonAdult" className="form-input" value={pricesForm.highSeasonAdult} onChange={handlePriceChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Adulto Temporada Baja ($)</label>
              <input type="number" name="lowSeasonAdult" className="form-input" value={pricesForm.lowSeasonAdult} onChange={handlePriceChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Niños (7-15 años) ($)</label>
              <input type="number" name="child" className="form-input" value={pricesForm.child} onChange={handlePriceChange} required />
            </div>
            
            <button type="submit" className="btn btn-primary">
              <Save size={18} /> Guardar Tarifas
            </button>
            {priceSaved && <span className="text-success save-msg">¡Tarifas actualizadas!</span>}
          </form>
        </div>

        {/* 3. Catálogo y Colores de Cabañas */}
        <div className="card glass-panel admin-section" style={{ gridColumn: '1 / -1' }}>
          <div className="section-header-row">
            <h2>Catálogo y Colores de Cabañas</h2>
            <button className="btn btn-primary btn-sm" onClick={openNewCabin}>
              <Plus size={18} /> Nueva Cabaña
            </button>
          </div>
          
          <div className="table-container">
            <table className="reservations-table">
              <thead>
                <tr>
                  <th>Nombre de Cabaña</th>
                  <th>Capacidad Máxima</th>
                  <th>Color en Calendario</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cabins.map(cabin => (
                  <tr key={cabin.id}>
                    <td><strong>{cabin.name}</strong></td>
                    <td>{cabin.maxCapacity} personas</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: cabin.color || '#2980b9' }}></div>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{cabin.color || '#2980b9'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn-icon" onClick={() => openEditCabin(cabin)} title="Editar cabaña y color"><Edit2 size={18} /></button>
                        <button className="btn-icon danger" onClick={() => handleDeleteCabin(cabin.id)} title="Eliminar cabaña"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cabin Modal */}
      {isCabinModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>{editingCabin ? 'Editar Cabaña' : 'Nueva Cabaña'}</h2>
              <button className="btn-icon" onClick={() => setIsCabinModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleCabinSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre de la Cabaña</label>
                <input type="text" className="form-input" value={cabinForm.name} onChange={e => setCabinForm({...cabinForm, name: e.target.value})} required placeholder="Ej: Cabaña Don Pedro" />
              </div>
              <div className="form-row" style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Capacidad Max. (Personas)</label>
                  <input type="number" min="1" className="form-input" value={cabinForm.maxCapacity} onChange={e => setCabinForm({...cabinForm, maxCapacity: Number(e.target.value)})} required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Color Distintivo (Calendario)</label>
                  <input type="color" className="form-input" style={{ padding: '0 5px', height: '40px', cursor: 'pointer' }} value={cabinForm.color} onChange={e => setCabinForm({...cabinForm, color: e.target.value})} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCabinModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cabaña</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
