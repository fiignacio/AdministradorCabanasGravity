import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Compass, Plus, Edit2, Trash2, X, DollarSign, Clock, Users } from 'lucide-react';
import './Admin.css'; // Reutilizamos el sistema de diseño de administración

const AdminTours = () => {
  const { tours, addTour, updateTour, deleteTour } = useStore();
  
  // Tour Form State
  const [editingTour, setEditingTour] = useState(null);
  const [isTourModalOpen, setIsTourModalOpen] = useState(false);
  const [tourForm, setTourForm] = useState({
    name: '', description: '', price: 0, duration: '3 Horas', maxCapacity: 10, color: '#8e44ad', isActive: true
  });

  const openNewTour = () => {
    setTourForm({ name: '', description: '', price: 35000, duration: '3 Horas', maxCapacity: 10, color: '#8e44ad', isActive: true });
    setEditingTour(null);
    setIsTourModalOpen(true);
  };

  const openEditTour = (tour) => {
    setTourForm(tour);
    setEditingTour(tour);
    setIsTourModalOpen(true);
  };

  const handleDeleteTour = (id) => {
    if (window.confirm('¿Eliminar este tour del catálogo?')) {
      deleteTour(id);
    }
  };

  const handleTourSubmit = (e) => {
    e.preventDefault();
    if (editingTour) {
      updateTour(editingTour.id, tourForm);
    } else {
      addTour(tourForm);
    }
    setIsTourModalOpen(false);
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1><Compass size={28} /> Panel de Administración de Tours</h1>
        <p className="text-secondary">Gestiona las excursiones, valores por persona, capacidades y detalles del servicio.</p>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: '1fr' }}>
        {/* Tours Management */}
        <div className="card glass-panel admin-section">
          <div className="section-header-row">
            <h2>Catálogo de Tours y Excursiones</h2>
            <button className="btn btn-primary btn-sm" onClick={openNewTour}>
              <Plus size={18} /> Nuevo Tour
            </button>
          </div>
          
          <div className="table-container">
            <table className="reservations-table">
              <thead>
                <tr>
                  <th>Nombre del Tour</th>
                  <th>Descripción</th>
                  <th>Tarifa / Persona</th>
                  <th>Duración</th>
                  <th>Capacidad Máx</th>
                  <th>Estado</th>
                  <th>Color (Calendario)</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tours.map(tour => (
                  <tr key={tour.id}>
                    <td><strong>{tour.name}</strong></td>
                    <td style={{ maxWidth: '250px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {tour.description || '-'}
                    </td>
                    <td>
                      <strong style={{ color: 'var(--success)' }}>
                        ${Number(tour.price).toLocaleString('es-CL')}
                      </strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem' }}>
                        <Clock size={14} style={{ display: 'inline', marginRight: 4 }} />
                        {tour.duration || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem' }}>
                        <Users size={14} style={{ display: 'inline', marginRight: 4 }} />
                        {tour.maxCapacity} Pax
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${tour.isActive ? 'confirmed' : 'blocked'}`}>
                        {tour.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: tour.color || '#8e44ad', margin: '0 auto' }}></div>
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn-icon" title="Editar Tour / Modificar Valores" onClick={() => openEditTour(tour)}>
                          <Edit2 size={18} />
                        </button>
                        <button className="btn-icon danger" title="Eliminar Tour" onClick={() => handleDeleteTour(tour.id)}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tours.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                      No hay tours registrados en el catálogo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tour Modal */}
      {isTourModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2>{editingTour ? 'Editar Tour / Modificar Valores' : 'Nuevo Tour'}</h2>
              <button className="btn-icon" onClick={() => setIsTourModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleTourSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre del Tour / Excursión</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={tourForm.name} 
                  onChange={e => setTourForm({...tourForm, name: e.target.value})} 
                  required 
                  placeholder="Ej: Tour Rapa Nui Completo" 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción Breve</label>
                <textarea 
                  className="form-input" 
                  rows="2" 
                  value={tourForm.description} 
                  onChange={e => setTourForm({...tourForm, description: e.target.value})} 
                  placeholder="Detalles sobre el recorrido o actividades..." 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tarifa por Persona ($)</label>
                  <input 
                    type="number" 
                    min="0" 
                    className="form-input" 
                    value={tourForm.price} 
                    onChange={e => setTourForm({...tourForm, price: Number(e.target.value)})} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Duración</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={tourForm.duration} 
                    onChange={e => setTourForm({...tourForm, duration: e.target.value})} 
                    placeholder="Ej: 3 Horas / 1 Día" 
                    required 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Capacidad Máxima (Pasajeros)</label>
                  <input 
                    type="number" 
                    min="1" 
                    className="form-input" 
                    value={tourForm.maxCapacity} 
                    onChange={e => setTourForm({...tourForm, maxCapacity: Number(e.target.value)})} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Color en Calendario</label>
                  <input 
                    type="color" 
                    className="form-input" 
                    style={{ padding: '0 5px', height: '40px' }} 
                    value={tourForm.color} 
                    onChange={e => setTourForm({...tourForm, color: e.target.value})} 
                    required 
                  />
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '1rem' }}>
                <input 
                  type="checkbox" 
                  id="isTourActive" 
                  checked={tourForm.isActive} 
                  onChange={e => setTourForm({...tourForm, isActive: e.target.checked})} 
                />
                <label htmlFor="isTourActive" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                  Tour Habilitado para Reservas
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsTourModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTours;
