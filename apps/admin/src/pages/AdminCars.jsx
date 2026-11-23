import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Car, Plus, Edit2, Trash2, X } from 'lucide-react';
import './Admin.css'; // Reutilizamos estilos

const AdminCars = () => {
  const { cars, addCar, updateCar, deleteCar } = useStore();
  
  // Car Form State
  const [editingCar, setEditingCar] = useState(null);
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [carForm, setCarForm] = useState({
    name: '', plate: '', dailyRate: 0, color: '#2980b9', isActive: true, promoThresholdDays: 0, promoDailyRate: 0
  });

  const openNewCar = () => {
    setCarForm({ name: '', plate: '', dailyRate: 40000, color: '#2980b9', isActive: true, promoThresholdDays: 0, promoDailyRate: 0 });
    setEditingCar(null);
    setIsCarModalOpen(true);
  };

  const openEditCar = (car) => {
    setCarForm(car);
    setEditingCar(car);
    setIsCarModalOpen(true);
  };

  const handleDeleteCar = (id) => {
    if (window.confirm('¿Eliminar este vehículo? (Se borrará del catálogo)')) {
      deleteCar(id);
    }
  };

  const handleCarSubmit = (e) => {
    e.preventDefault();
    if (editingCar) {
      updateCar(editingCar.id, carForm);
    } else {
      addCar(carForm);
    }
    setIsCarModalOpen(false);
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1><Car size={28} /> Panel de Vehículos</h1>
        <p className="text-secondary">Gestiona tu flota de vehículos y sus tarifas de arriendo.</p>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: '1fr' }}>
        {/* Cars Management */}
        <div className="card glass-panel admin-section">
          <div className="section-header-row">
            <h2>Flota de Arriendo</h2>
            <button className="btn btn-primary btn-sm" onClick={openNewCar}>
              <Plus size={18} /> Nuevo Vehículo
            </button>
          </div>
          
          <div className="table-container">
            <table className="reservations-table">
              <thead>
                <tr>
                  <th>Vehículo</th>
                  <th>Patente</th>
                  <th>Tarifa Diaria</th>
                  <th>Promoción</th>
                  <th>Estado</th>
                  <th>Color (Calendario)</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cars.map(car => (
                  <tr key={car.id}>
                    <td><strong>{car.name}</strong></td>
                    <td>{car.plate}</td>
                    <td>${car.dailyRate.toLocaleString('es-CL')}</td>
                    <td>
                      {car.promoThresholdDays > 0 ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                          Desde {car.promoThresholdDays} días: ${car.promoDailyRate.toLocaleString('es-CL')}/día
                        </span>
                      ) : (
                        <span className="text-secondary">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${car.isActive ? 'confirmed' : 'blocked'}`}>
                        {car.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: car.color }}></div>
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn-icon" onClick={() => openEditCar(car)}><Edit2 size={18} /></button>
                        <button className="btn-icon danger" onClick={() => handleDeleteCar(car.id)}><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Car Modal */}
      {isCarModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>{editingCar ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h2>
              <button className="btn-icon" onClick={() => setIsCarModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleCarSubmit}>
              <div className="form-group">
                <label className="form-label">Modelo del Vehículo</label>
                <input type="text" className="form-input" value={carForm.name} onChange={e => setCarForm({...carForm, name: e.target.value})} required placeholder="Ej: Suzuki Jimny" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Patente</label>
                  <input type="text" className="form-input" value={carForm.plate} onChange={e => setCarForm({...carForm, plate: e.target.value})} required placeholder="XX-YY-11"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Tarifa Diaria ($)</label>
                  <input type="number" min="0" className="form-input" value={carForm.dailyRate} onChange={e => setCarForm({...carForm, dailyRate: Number(e.target.value)})} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Color en Calendario</label>
                  <input type="color" className="form-input" style={{ padding: '0 5px', height: '40px' }} value={carForm.color} onChange={e => setCarForm({...carForm, color: e.target.value})} required />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '1.5rem' }}>
                  <input type="checkbox" id="isActive" checked={carForm.isActive} onChange={e => setCarForm({...carForm, isActive: e.target.checked})} />
                  <label htmlFor="isActive" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Vehículo Disponible para Arriendo</label>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Promoción por Volumen de Días</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Aplicar si arrienda al menos (días)</label>
                    <input type="number" min="0" className="form-input" value={carForm.promoThresholdDays} onChange={e => setCarForm({...carForm, promoThresholdDays: Number(e.target.value)})} placeholder="Ej: 3 (0 para no aplicar)" />
                    <small className="text-secondary">Pon 0 si no deseas ofrecer promoción.</small>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nueva Tarifa Diaria Promocional ($)</label>
                    <input type="number" min="0" className="form-input" value={carForm.promoDailyRate} onChange={e => setCarForm({...carForm, promoDailyRate: Number(e.target.value)})} />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCarModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Vehículo</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCars;
