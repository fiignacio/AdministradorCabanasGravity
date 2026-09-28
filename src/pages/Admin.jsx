import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Settings, Save, Building2, Palette, RefreshCw, Upload, Image as ImageIcon, Trash2, Plus, Edit2, X, Share2, Copy, ExternalLink, Check, Calendar, Sun, CloudSun, Tag, Percent, Users as UsersIcon } from 'lucide-react';
import { MONTHS, getHighSeasonText, getLowSeasonText } from '../utils/pricing';
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
    seasonConfig, updateSeasonConfig,
    discountConfig, updateDiscountConfig,
    cabins, addCabin, updateCabin, deleteCabin,
    businessConfig, updateBusinessConfig, resetSetup 
  } = useStore();


  const [copiedPublicLink, setCopiedPublicLink] = useState(false);

  const publicLink = `${window.location.origin}/disponibilidad`;

  const handleCopyPublicLink = () => {
    navigator.clipboard.writeText(publicLink);
    setCopiedPublicLink(true);
    setTimeout(() => setCopiedPublicLink(false), 2500);
  };
  
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

  // Season Config State
  const [seasonForm, setSeasonForm] = useState({
    highSeasonMonths: seasonConfig?.highSeasonMonths || [11, 0, 1, 2, 3],
    highSeasonName: seasonConfig?.highSeasonName || 'Temporada Alta',
    lowSeasonName: seasonConfig?.lowSeasonName || 'Temporada Baja'
  });

  const toggleHighSeasonMonth = (monthId) => {
    setSeasonForm(prev => {
      const current = prev.highSeasonMonths || [];
      const updated = current.includes(monthId)
        ? current.filter(m => m !== monthId)
        : [...current, monthId];
      return { ...prev, highSeasonMonths: updated };
    });
    setPriceSaved(false);
  };


  // Discount Config State
  const [discountForm, setDiscountForm] = useState({
    enableGroupDiscount: discountConfig?.enableGroupDiscount ?? true,
    groupMinGuests: discountConfig?.groupMinGuests || 10,
    groupRatePerAdult: discountConfig?.groupRatePerAdult || 25000,
    
    enableDurationDiscount: discountConfig?.enableDurationDiscount ?? false,
    durationMinNights: discountConfig?.durationMinNights || 7,
    durationDiscountPercent: discountConfig?.durationDiscountPercent || 10
  });
  const [discountSaved, setDiscountSaved] = useState(false);

  const handleSaveDiscounts = (e) => {
    e.preventDefault();
    updateDiscountConfig(discountForm);
    setDiscountSaved(true);
    setTimeout(() => setDiscountSaved(false), 3000);
  };


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
    updateSeasonConfig(seasonForm);
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

          {/* Enlace Compartible de Portal Público */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.2rem', borderTop: '1px dashed var(--border-color)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Share2 size={18} color="var(--accent-primary)" /> Enlace de Consulta Pública para Clientes
            </h3>
            <p className="text-secondary" style={{ fontSize: '0.82rem', margin: '0 0 0.8rem 0' }}>
              Comparte este enlace por WhatsApp o Redes Sociales para que tus clientes miren disponibilidad y coticen directamente.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                readOnly 
                className="form-input" 
                value={publicLink} 
                style={{ background: 'rgba(0,0,0,0.05)', fontSize: '0.85rem' }} 
              />
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleCopyPublicLink}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                {copiedPublicLink ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
                {copiedPublicLink ? '¡Copiado!' : 'Copiar'}
              </button>
              <a 
                href="/disponibilidad" 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-secondary"
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none' }}
                title="Probar vista pública"
              >
                <ExternalLink size={16} /> Ver
              </a>
            </div>
          </div>
        </div>

        {/* 2. Tarifas Globales y Personalización de Temporadas */}
        <div className="card glass-panel admin-section">
          <h2><Sun size={22} style={{ display: 'inline', marginRight: 8, color: '#e67e22' }} /> Tarifas y Configuración de Temporadas</h2>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Personaliza los meses que corresponden a Temporada Alta / Baja y ajusta sus tarifas.</p>
          
          <form onSubmit={handleSavePrices} className="prices-form">
            <div className="form-group" style={{ marginBottom: '1.2rem', background: 'rgba(255,255,255,0.4)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
              <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                <Calendar size={16} color="var(--accent-primary)" /> Selecciona los Meses de Temporada Alta
              </label>
              <p className="text-secondary" style={{ fontSize: '0.78rem', margin: '2px 0 8px 0' }}>
                Haz clic en los meses para activarlos o desactivarlos como Temporada Alta. Los meses no seleccionados serán automáticamente Temporada Baja.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px' }}>
                {MONTHS.map(m => {
                  const isHigh = seasonForm.highSeasonMonths.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleHighSeasonMonth(m.id)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: isHigh ? '2px solid #e67e22' : '1px solid #cbd5e1',
                        background: isHigh ? 'linear-gradient(135deg, #f39c12, #e67e22)' : '#ffffff',
                        color: isHigh ? '#ffffff' : '#334155',
                        fontWeight: isHigh ? 'bold' : 'normal',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                        boxShadow: isHigh ? '0 2px 5px rgba(230, 126, 34, 0.3)' : 'none'
                      }}
                    >
                      {m.short} {isHigh ? '☀️' : '❄️'}
                    </button>
                  );
                })}
              </div>

              {/* Summary Badges */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(230, 126, 34, 0.12)', padding: '6px 10px', borderRadius: '6px', borderLeft: '3px solid #e67e22', color: '#b45309' }}>
                  <Sun size={14} color="#e67e22" />
                  <span><strong>Temporada Alta:</strong> {getHighSeasonText(seasonForm)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(52, 152, 219, 0.12)', padding: '6px 10px', borderRadius: '6px', borderLeft: '3px solid #3498db', color: '#1d4ed8' }}>
                  <CloudSun size={14} color="#3498db" />
                  <span><strong>Temporada Baja:</strong> {getLowSeasonText(seasonForm)}</span>
                </div>
              </div>
            </div>

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
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">
                <Save size={18} /> Guardar Tarifas y Temporadas
              </button>
              {priceSaved && <span className="text-success save-msg">¡Tarifas y temporadas actualizadas!</span>}
            </div>
          </form>
        </div>

        {/* 3. Reglas de Descuento (Grupos y Larga Estadía) */}
        <div className="card glass-panel admin-section">
          <h2><Tag size={22} style={{ display: 'inline', marginRight: 8, color: '#16a085' }} /> Reglas de Descuento (Configurables)</h2>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Activa o desactiva los descuentos automáticos por cantidad de personas o días de estadía.</p>
          
          <form onSubmit={handleSaveDiscounts} className="prices-form">
            {/* Descuento por Grupos */}
            <div style={{ background: 'rgba(255,255,255,0.4)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, cursor: 'pointer', marginBottom: '8px', color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={discountForm.enableGroupDiscount}
                  onChange={e => setDiscountForm({...discountForm, enableGroupDiscount: e.target.checked})}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <UsersIcon size={18} color="#2980b9" /> Descuento por Cantidad de Personas (Grupos Grandes)
              </label>

              {discountForm.enableGroupDiscount && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Mínimo de Personas</label>
                    <input 
                      type="number" 
                      min="2"
                      className="form-input" 
                      value={discountForm.groupMinGuests} 
                      onChange={e => setDiscountForm({...discountForm, groupMinGuests: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Tarifa Especial Adulto ($)</label>
                    <input 
                      type="number" 
                      min="0"
                      className="form-input" 
                      value={discountForm.groupRatePerAdult} 
                      onChange={e => setDiscountForm({...discountForm, groupRatePerAdult: Number(e.target.value)})} 
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Descuento por Larga Estadía */}
            <div style={{ background: 'rgba(255,255,255,0.4)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, cursor: 'pointer', marginBottom: '8px', color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={discountForm.enableDurationDiscount}
                  onChange={e => setDiscountForm({...discountForm, enableDurationDiscount: e.target.checked})}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <Percent size={18} color="#8e44ad" /> Descuento por Larga Estadía (Días / Noches)
              </label>

              {discountForm.enableDurationDiscount && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Mínimo de Noches</label>
                    <input 
                      type="number" 
                      min="1"
                      className="form-input" 
                      value={discountForm.durationMinNights} 
                      onChange={e => setDiscountForm({...discountForm, durationMinNights: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>% Descuento Total (%)</label>
                    <input 
                      type="number" 
                      min="1"
                      max="100"
                      className="form-input" 
                      value={discountForm.durationDiscountPercent} 
                      onChange={e => setDiscountForm({...discountForm, durationDiscountPercent: Number(e.target.value)})} 
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">
                <Save size={18} /> Guardar Reglas de Descuento
              </button>
              {discountSaved && <span className="text-success save-msg">¡Descuentos guardados!</span>}
            </div>
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
