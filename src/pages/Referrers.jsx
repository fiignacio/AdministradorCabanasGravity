import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Users, Plus, Edit2, Trash2, CheckCircle, Clock, FileText, Download } from 'lucide-react';
import { formatSafeDate, parseSafeDate } from '../utils/dateUtils';
import html2pdf from 'html2pdf.js';
import './Referrers.css';

const Referrers = () => {
  const { referrers = [], reservations = [], cabins = [], addReferrer, updateReferrer, deleteReferrer, updateReservation } = useStore();

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });

  const months = [
    { id: 'all', name: 'Todos los meses' },
    { id: '0', name: 'Enero' }, { id: '1', name: 'Febrero' }, { id: '2', name: 'Marzo' },
    { id: '3', name: 'Abril' }, { id: '4', name: 'Mayo' }, { id: '5', name: 'Junio' },
    { id: '6', name: 'Julio' }, { id: '7', name: 'Agosto' }, { id: '8', name: 'Septiembre' },
    { id: '9', name: 'Octubre' }, { id: '10', name: 'Noviembre' }, { id: '11', name: 'Diciembre' }
  ];

  const years = ['2024', '2025', '2026', '2027'];

  // Filter reservations by month and year
  const relevantReservations = reservations.filter(res => {
    if (res.status === 'blocked') return false;
    if (!res.startDate) return false;
    const date = parseSafeDate(res.startDate);
    const matchMonth = selectedMonth === 'all' || date.getMonth().toString() === selectedMonth;
    const matchYear = date.getFullYear().toString() === selectedYear;
    return matchMonth && matchYear;
  });

  const handleSaveReferrer = (e) => {
    e.preventDefault();
    if (editingId) {
      updateReferrer(editingId, formData);
    } else {
      addReferrer({ ...formData, createdAt: new Date().toISOString() });
    }
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', phone: '', email: '' });
  };

  const handleEdit = (referrer) => {
    setEditingId(referrer.id);
    setFormData({ name: referrer.name, phone: referrer.phone || '', email: referrer.email || '' });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Está seguro de eliminar este referente?')) {
      deleteReferrer(id);
    }
  };

  const handleToggleStatus = (reservation) => {
    const newStatus = reservation.referrerStatus === 'paid' ? 'pending' : 'paid';
    updateReservation(reservation.id, { referrerStatus: newStatus });
  };

  const generatePDF = (referrerId = null) => {
    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.fontFamily = 'sans-serif';
    element.style.color = '#333';

    let targetReferrers = referrers;
    if (referrerId) {
      targetReferrers = referrers.filter(r => r.id === referrerId);
    }

    const monthName = months.find(m => m.id === selectedMonth)?.name || 'General';

    let html = `
      <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
        <h2>Reporte de Cuadre de Referentes y Agencias</h2>
        <p><strong>Período:</strong> ${monthName} ${selectedYear}</p>
      </div>
    `;

    targetReferrers.forEach(ref => {
      const refReservations = relevantReservations.filter(res => res.referrerId === ref.id);
      const totalCobrado = refReservations.filter(r => r.referrerStatus === 'paid').reduce((sum, r) => sum + Number(r.totalCost), 0);
      const totalPendiente = refReservations.filter(r => r.referrerStatus !== 'paid').reduce((sum, r) => sum + Number(r.totalCost), 0);

      html += `
        <div style="margin-bottom: 30px; border: 1px solid #ccc; padding: 15px; border-radius: 8px;">
          <h3 style="margin-top: 0; color: #2c3e50;">${ref.name}</h3>
          <p style="font-size: 0.9rem; color: #666;">Contacto: ${ref.phone || 'S/T'} ${ref.email ? '| ' + ref.email : ''}</p>
          
          <div style="display: flex; gap: 20px; margin-bottom: 15px;">
            <div style="background: #e8f8f5; padding: 10px; border-radius: 5px; flex: 1;">
              <small>Total Cobrado:</small><br/>
              <strong style="color: #27ae60; font-size: 1.2rem;">$${totalCobrado.toLocaleString('es-CL')}</strong>
            </div>
            <div style="background: #fef9e7; padding: 10px; border-radius: 5px; flex: 1;">
              <small>Total Pendiente:</small><br/>
              <strong style="color: #d35400; font-size: 1.2rem;">$${totalPendiente.toLocaleString('es-CL')}</strong>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
              <tr style="background: #f2f2f2; text-align: left;">
                <th style="padding: 8px; border-bottom: 1px solid #ddd;">Cliente</th>
                <th style="padding: 8px; border-bottom: 1px solid #ddd;">Cabaña</th>
                <th style="padding: 8px; border-bottom: 1px solid #ddd;">Fechas</th>
                <th style="padding: 8px; border-bottom: 1px solid #ddd;">Monto</th>
                <th style="padding: 8px; border-bottom: 1px solid #ddd;">Estado Comision/Pago</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (refReservations.length === 0) {
        html += `<tr><td colspan="5" style="padding: 8px; text-align: center; color: #999;">Sin reservas en este período.</td></tr>`;
      } else {
        refReservations.forEach(res => {
          const cabin = cabins.find(c => c.id === res.cabinId);
          const isPaid = res.referrerStatus === 'paid';
          html += `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${res.clientName}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${cabin?.name || ''}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${res.startDate} al ${res.endDate}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">$${Number(res.totalCost).toLocaleString('es-CL')}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${isPaid ? '#27ae60' : '#d35400'}; font-weight: bold;">
                ${isPaid ? 'Cobrado' : 'Pendiente'}
              </td>
            </tr>
          `;
        });
      }

      html += `
            </tbody>
          </table>
        </div>
      `;
    });

    element.innerHTML = html;

    const opt = {
      margin: 0.5,
      filename: `Referentes_${referrerId ? 'Individual' : 'General'}_${selectedMonth}_${selectedYear}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const generateCSV = () => {
    const headers = ["Referente", "Cliente", "Cabaña", "Fecha Inicio", "Fecha Fin", "Monto Total", "Estado"];
    const rows = [];

    referrers.forEach(ref => {
      const refReservations = relevantReservations.filter(res => res.referrerId === ref.id);
      refReservations.forEach(res => {
        const cabin = cabins.find(c => c.id === res.cabinId);
        rows.push([
          `"${ref.name}"`,
          `"${res.clientName}"`,
          `"${cabin?.name || ''}"`,
          `"${res.startDate}"`,
          `"${res.endDate}"`,
          res.totalCost,
          res.referrerStatus === 'paid' ? 'Cobrado' : 'Pendiente'
        ].join(','));
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Referentes_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="referrers-container">
      <div className="header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1>Cuadre de Referentes y Agencias</h1>
          <p className="text-secondary">Gestión de comisiones, ventas referidas por terceros y seguimiento de pagos.</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={generateCSV}><FileText size={18} /> Exportar CSV</button>
          <button className="btn btn-primary" onClick={() => generatePDF()}><Download size={18} /> Exportar PDF General</button>
        </div>
      </div>

      <div className="filters-glass">
        <div className="filter-group">
          <label className="form-label">Mes</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="form-input">
            {months.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="form-label">Año</label>
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="form-input">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="filter-group" style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData({ name: '', phone: '', email: '' }); }}>
            <Plus size={18} /> Nuevo Referente
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card glass-panel" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
          <h3>{editingId ? 'Editar Referente' : 'Nuevo Referente'}</h3>
          <form onSubmit={handleSaveReferrer} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label">Nombre / Agencia</label>
              <input type="text" className="form-input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label">Teléfono</label>
              <input type="text" className="form-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">Guardar</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="referrers-grid">
        {referrers.map(ref => {
          const refReservations = relevantReservations.filter(res => res.referrerId === ref.id);
          
          const totalCobrado = refReservations.filter(r => r.referrerStatus === 'paid').reduce((sum, r) => sum + Number(r.totalCost), 0);
          const totalPendiente = refReservations.filter(r => r.referrerStatus !== 'paid').reduce((sum, r) => sum + Number(r.totalCost), 0);
          
          return (
            <div key={ref.id} className="referrer-card glass-panel card">
              <div className="ref-header">
                <div className="ref-info">
                  <h3><Users size={20} /> {ref.name}</h3>
                  <p>{ref.phone || 'Sin teléfono'} {ref.email ? `| ${ref.email}` : ''}</p>
                </div>
                <div className="ref-actions">
                  <button className="btn-icon" onClick={() => handleEdit(ref)} title="Editar"><Edit2 size={18} /></button>
                  <button className="btn-icon" onClick={() => generatePDF(ref.id)} title="Descargar PDF individual"><Download size={18} /></button>
                  <button className="btn-icon text-danger" onClick={() => handleDelete(ref.id)} title="Eliminar"><Trash2 size={18} /></button>
                </div>
              </div>

              <div className="ref-stats">
                <div className="stat-box success">
                  <span className="stat-label">Cobrado</span>
                  <span className="stat-value">${totalCobrado.toLocaleString('es-CL')}</span>
                </div>
                <div className="stat-box warning">
                  <span className="stat-label">Pendiente</span>
                  <span className="stat-value">${totalPendiente.toLocaleString('es-CL')}</span>
                </div>
              </div>

              {refReservations.length > 0 ? (
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Cliente / Cabaña</th>
                        <th style={{ padding: '8px' }}>Fechas</th>
                        <th style={{ padding: '8px' }}>Total Reserva</th>
                        <th style={{ padding: '8px' }}>Estado Pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {refReservations.map(res => {
                        const cabin = cabins.find(c => c.id === res.cabinId);
                        const isPaid = res.referrerStatus === 'paid';
                        
                        return (
                          <tr key={res.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                            <td style={{ padding: '8px' }}>
                              <strong>{res.clientName}</strong><br/>
                              <span style={{ fontSize: '0.8rem', color: '#666' }}>{cabin?.name}</span>
                            </td>
                            <td style={{ padding: '8px', fontSize: '0.85rem' }}>
                              {formatSafeDate(res.startDate, 'dd/MM/yyyy')} - {formatSafeDate(res.endDate, 'dd/MM/yyyy')}
                            </td>
                            <td style={{ padding: '8px', fontWeight: 'bold' }}>${Number(res.totalCost).toLocaleString('es-CL')}</td>
                            <td style={{ padding: '8px' }}>
                              <button 
                                className={`status-toggle ${isPaid ? 'paid' : 'pending'}`}
                                onClick={() => handleToggleStatus(res)}
                              >
                                {isPaid ? <><CheckCircle size={14} /> Cobrado</> : <><Clock size={14} /> Pendiente</>}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                  No hay reservas referidas por este referente en este período.
                </p>
              )}
            </div>
          );
        })}
        {referrers.length === 0 && (
          <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>
            No hay referentes registrados. Haz clic en "Nuevo Referente" para agregar uno.
          </p>
        )}
      </div>
    </div>
  );
};

export default Referrers;
