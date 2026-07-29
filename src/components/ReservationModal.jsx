import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Lock, FileText } from 'lucide-react';
import { useStore } from '../store/useStore';
import { calculateReservationCost } from '../utils/pricing';
import { parseSafeDate } from '../utils/dateUtils';
import './ReservationModal.css';

const ReservationModal = ({ isOpen, onClose, reservationToEdit, initialData }) => {
  const { cabins, prices, addReservation, updateReservation, reservations, cars, carReservations, addCarReservation, updateCarReservation, deleteCarReservation } = useStore();
  const navigate = useNavigate();
  
  const [carData, setCarData] = useState({
    hasCar: false,
    carId: '',
    carTotalCost: 0,
    carDepositAmount: 0,
    linkedCarResId: null,
    isFullStay: true,
    startDate: '',
    endDate: '',
    carPaymentMethod: ''
  });
  
  const [formData, setFormData] = useState({
    cabinId: '',
    clientName: '',
    startDate: '',
    endDate: '',
    adults: 1,
    childrenCount: 0,
    babiesCount: 0,
    flightOut: '',
    isBlock: false,
    depositAmount: 0,
    paymentMethod: '',
    clientPhone: '',
    referrerId: '',
    referrerStatus: 'pending',
    notes: ''
  });
  
  const [error, setError] = useState('');
  const [totalCost, setTotalCost] = useState(0);
  const [lastCalculatedCost, setLastCalculatedCost] = useState(0);

  useEffect(() => {
    if (reservationToEdit) {
      const linked = carReservations.find(cr => cr.linkedCabinReservationId === reservationToEdit.id);
      const isFullStay = linked ? (linked.startDate === reservationToEdit.startDate && linked.endDate === reservationToEdit.endDate) : true;
      setCarData({
        hasCar: !!linked,
        carId: linked ? linked.carId : '',
        carTotalCost: linked ? linked.totalCost : 0,
        carDepositAmount: linked ? linked.depositAmount : 0,
        linkedCarResId: linked ? linked.id : null,
        isFullStay: isFullStay,
        startDate: linked ? linked.startDate : '',
        endDate: linked ? linked.endDate : '',
        carPaymentMethod: linked ? linked.paymentMethod || '' : ''
      });

      setFormData({
        ...reservationToEdit,
        flightIn: reservationToEdit.flightIn || '',
        flightOut: reservationToEdit.flightOut || '',
        depositAmount: reservationToEdit.depositAmount || 0,
        paymentMethod: reservationToEdit.paymentMethod || '',
        clientPhone: reservationToEdit.clientPhone || '',
        notes: reservationToEdit.notes || ''
      });
      setTotalCost(reservationToEdit.totalCost);
      setLastCalculatedCost(reservationToEdit.totalCost);
    } else if (initialData) {
      setCarData({ hasCar: false, carId: '', carTotalCost: 0, carDepositAmount: 0, linkedCarResId: null, isFullStay: true, startDate: '', endDate: '', carPaymentMethod: '' });
      setFormData({
        cabinId: initialData.cabinId || cabins[0]?.id || '',
        clientName: '',
        startDate: initialData.startDate || '',
        endDate: initialData.endDate || '',
        adults: 1,
        childrenCount: 0,
        babiesCount: 0,
        flightIn: '',
        flightOut: '',
        isBlock: false,
        depositAmount: 0,
        paymentMethod: '',
        clientPhone: '',
        notes: ''
      });
      setTotalCost(0);
      setLastCalculatedCost(0);
    } else {
      setCarData({ hasCar: false, carId: '', carTotalCost: 0, carDepositAmount: 0, linkedCarResId: null, isFullStay: true, startDate: '', endDate: '', carPaymentMethod: '' });
      setFormData({
        cabinId: cabins[0]?.id || '',
        clientName: '',
        startDate: '',
        endDate: '',
        adults: 1,
        childrenCount: 0,
        babiesCount: 0,
        flightIn: '',
        flightOut: '',
        isBlock: false,
        depositAmount: 0,
        paymentMethod: '',
        clientPhone: '',
        referrerId: '',
        referrerStatus: 'pending',
        notes: ''
      });
    }
  }, [reservationToEdit, initialData, cabins, isOpen]);

  useEffect(() => {
    if (formData.startDate && formData.endDate && !formData.isBlock) {
      const cost = calculateReservationCost(
        formData.startDate, 
        formData.endDate, 
        Number(formData.adults), 
        Number(formData.childrenCount),
        prices
      );
      
      // Auto-actualizar solo si el usuario no ha puesto un precio manual
      if (totalCost === lastCalculatedCost || totalCost === 0) {
        setTotalCost(cost);
      }
      setLastCalculatedCost(cost);
    } else {
      if (totalCost === lastCalculatedCost) {
        setTotalCost(0);
      }
      setLastCalculatedCost(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.startDate, formData.endDate, formData.adults, formData.childrenCount, formData.isBlock, prices]);

  useEffect(() => {
    const sDate = carData.isFullStay ? formData.startDate : carData.startDate;
    const eDate = carData.isFullStay ? formData.endDate : carData.endDate;
    if (carData.hasCar && carData.carId && sDate && eDate) {
      const s = parseSafeDate(sDate);
      const e = parseSafeDate(eDate);
      if (s >= e) return;
      const d = Math.max(1, Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)));
      const c = cars.find(car => car.id === carData.carId);
      if (c) {
        const rate = (c.promoThresholdDays > 0 && d >= c.promoThresholdDays) ? c.promoDailyRate : c.dailyRate;
        const suggested = rate * d;
        if (carData.carTotalCost === 0) {
           setCarData(prev => ({ ...prev, carTotalCost: suggested }));
        }
      }
    }
  }, [carData.hasCar, carData.carId, carData.isFullStay, carData.startDate, carData.endDate, formData.startDate, formData.endDate, cars]);

  const checkCabinAvailability = (cabinId) => {
    if (!formData.startDate || !formData.endDate) return true;
    
    const start = parseSafeDate(formData.startDate);
    const end = parseSafeDate(formData.endDate);
    
    if (start >= end) return true;
    
    return !reservations.some(res => {
      if (res.status === 'archived') return false;
      if (reservationToEdit && res.id === reservationToEdit.id) return false;
      if (res.cabinId !== cabinId) return false;

      const resStart = parseSafeDate(res.startDate);
      const resEnd = parseSafeDate(res.endDate);
      
      // Standard overlap check: strictly overlaps (not adjacent)
      return start < resEnd && end > resStart;
    });
  };

  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const isCurrentAvailable = checkCabinAvailability(formData.cabinId);
      if (!isCurrentAvailable) {
        const firstAvailable = cabins.find(c => checkCabinAvailability(c.id));
        if (firstAvailable) {
          setFormData(prev => ({ ...prev, cabinId: firstAvailable.id }));
        }
      }
    }
  }, [formData.startDate, formData.endDate]); // eslint-disable-next-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const cabin = cabins.find(c => c.id === formData.cabinId);
    if (!cabin) {
      setError('Seleccione una cabaña válida.');
      return;
    }

    if (!formData.isBlock) {
      const totalGuests = Number(formData.adults) + Number(formData.childrenCount);
      if (totalGuests > cabin.maxCapacity) {
        const confirmBypass = window.confirm(`La capacidad recomendada de esta cabaña es de ${cabin.maxCapacity} personas (sin contar bebés). Has ingresado ${totalGuests} personas. ¿Están los pasajeros de acuerdo en acomodarse excediendo la capacidad?`);
        if (!confirmBypass) {
          setError(`La capacidad sugerida es de ${cabin.maxCapacity} personas.`);
          return;
        }
      }
    }

    if (parseSafeDate(formData.startDate) >= parseSafeDate(formData.endDate)) {
      setError('La fecha de salida debe ser posterior a la de entrada.');
      return;
    }

    const start = parseSafeDate(formData.startDate);
    const end = parseSafeDate(formData.endDate);
    
    const isOverlap = reservations.some(res => {
      if (res.status === 'archived') return false;
      if (reservationToEdit && res.id === reservationToEdit.id) return false;
      if (res.cabinId !== formData.cabinId) return false;

      const resStart = parseSafeDate(res.startDate);
      const resEnd = parseSafeDate(res.endDate);
      
      return start < resEnd && end > resStart;
    });

    if (isOverlap) {
      setError('La cabaña ya está reservada o bloqueada en estas fechas. Elige otra.');
      return;
    }

    const isAdjacent = reservations.some(res => {
      if (res.status === 'archived') return false;
      if (reservationToEdit && res.id === reservationToEdit.id) return false;
      if (res.cabinId !== formData.cabinId) return false;

      const resStart = parseSafeDate(res.startDate);
      const resEnd = parseSafeDate(res.endDate);
      
      return start.getTime() === resEnd.getTime() || end.getTime() === resStart.getTime();
    });

    if (isAdjacent) {
      const confirmSave = window.confirm('⚠️ Atención: Has seleccionado una fecha que coincide con la llegada o salida de otra reserva en la misma cabaña (Turnover). ¿Estás seguro que deseas agendarla en este día?');
      if (!confirmSave) return;
    }

    if (!formData.isBlock && carData.hasCar && carData.carId) {
      const cStart = parseSafeDate(carData.isFullStay ? formData.startDate : carData.startDate);
      const cEnd = parseSafeDate(carData.isFullStay ? formData.endDate : carData.endDate);
      
      if (cStart >= cEnd) {
        setError('Las fechas del vehículo no son válidas. La salida debe ser posterior a la llegada.');
        return;
      }

      const isCarOverlapping = carReservations.some(res => {
        if (res.carId !== carData.carId) return false;
        if (carData.linkedCarResId && res.id === carData.linkedCarResId) return false;
        const resStart = parseSafeDate(res.startDate);
        const resEnd = parseSafeDate(res.endDate);
        return cStart < resEnd && cEnd > resStart;
      });
      if (isCarOverlapping) {
        setError('El vehículo seleccionado ya está reservado en estas fechas.');
        return;
      }
    }

    const payload = {
      ...formData,
      clientName: formData.isBlock ? 'Bloqueo/Mantenimiento' : formData.clientName,
      totalCost: formData.isBlock ? 0 : totalCost,
      status: formData.isBlock ? 'blocked' : 'confirmed'
    };

    if (reservationToEdit) {
      updateReservation(reservationToEdit.id, payload);
      if (!formData.isBlock) {
        if (carData.hasCar && carData.carId) {
          const carPayload = {
            carId: carData.carId,
            clientName: formData.clientName,
            clientPhone: formData.clientPhone,
            startDate: carData.isFullStay ? formData.startDate : carData.startDate,
            endDate: carData.isFullStay ? formData.endDate : carData.endDate,
            totalCost: carData.carTotalCost,
            depositAmount: carData.carDepositAmount,
            paymentMethod: carData.carPaymentMethod,
            status: 'confirmed',
            linkedCabinReservationId: reservationToEdit.id
          };
          if (carData.linkedCarResId) {
            updateCarReservation(carData.linkedCarResId, carPayload);
          } else {
            addCarReservation(carPayload);
          }
        } else if (carData.linkedCarResId) {
          deleteCarReservation(carData.linkedCarResId);
        }
      }
    } else {
      const newCabinResId = addReservation(payload);
      if (!formData.isBlock && carData.hasCar && carData.carId && newCabinResId) {
        addCarReservation({
            carId: carData.carId,
            clientName: formData.clientName,
            clientPhone: formData.clientPhone,
            startDate: carData.isFullStay ? formData.startDate : carData.startDate,
            endDate: carData.isFullStay ? formData.endDate : carData.endDate,
            totalCost: carData.carTotalCost,
            depositAmount: carData.carDepositAmount,
            paymentMethod: carData.carPaymentMethod,
            status: 'confirmed',
            linkedCabinReservationId: newCabinResId
        });
      }
    }
    
    onClose();
  };

  const handleGenerateCarta = () => {
    navigate('/admin/tools/passengers', { state: { reservation: formData } });
    onClose();
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const getSeason = (dateString) => {
    if (!dateString) return null;
    const date = parseSafeDate(dateString);
    const month = date.getMonth();
    if (month === 11 || month === 0 || month === 1 || month === 2) return 'Alta';
    return 'Baja';
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel">
        <div className="modal-header">
          <h2>
            {reservationToEdit 
              ? (formData.isBlock ? 'Editar Bloqueo' : 'Editar Reserva') 
              : 'Nueva Reserva/Bloqueo'}
          </h2>
          <button className="btn-icon" onClick={onClose}><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="reservation-form">
          {error && <div className="alert alert-danger">{error}</div>}
          
          <div className="form-group checkbox-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                name="isBlock" 
                checked={formData.isBlock} 
                onChange={handleChange} 
              />
              <Lock size={16} /> Bloquear disponibilidad (Mantenimiento/Cierre)
            </label>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{formData.isBlock ? 'Inicio Bloqueo' : 'Llegada'}</label>
              <input 
                type="date" 
                name="startDate" 
                className="form-input" 
                value={formData.startDate} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">{formData.isBlock ? 'Fin Bloqueo' : 'Salida'}</label>
              <input 
                type="date" 
                name="endDate" 
                className="form-input" 
                value={formData.endDate} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>

          {formData.startDate && (() => {
            const season = getSeason(formData.startDate);
            return (
              <div style={{ marginBottom: '1rem', padding: '0.5rem', borderRadius: '8px', background: season === 'Alta' ? 'rgba(231, 76, 60, 0.1)' : 'rgba(52, 152, 219, 0.1)', color: season === 'Alta' ? 'var(--danger)' : 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                <span style={{ marginRight: '8px' }}>{season === 'Alta' ? '🔥' : '❄️'}</span>
                Temporada de la reserva: {season}
              </div>
            );
          })()}

          <div className="form-group">
            <label className="form-label">Selección de Cabaña</label>
            <div className="cabin-selector-grid">
              {cabins.map(cabin => {
                const isAvailable = checkCabinAvailability(cabin.id);
                const isSelected = formData.cabinId === cabin.id;
                
                return (
                  <div 
                    key={cabin.id}
                    className={`cabin-pill ${isAvailable ? 'available' : 'unavailable'} ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (isAvailable) {
                        setFormData(prev => ({ ...prev, cabinId: cabin.id }));
                      }
                    }}
                  >
                    <div className="cabin-pill-name">{cabin.name}</div>
                    <div className="cabin-pill-cap">Max {cabin.maxCapacity} pers.</div>
                    {!isAvailable && <div className="cabin-pill-status">⛔ Ocupada</div>}
                    {isAvailable && <div className="cabin-pill-status">✅ Disponible</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {!formData.isBlock && (
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Cliente</label>
                <input 
                  type="text" 
                  name="clientName" 
                  className="form-input" 
                  value={formData.clientName} 
                  onChange={handleChange} 
                  required={!formData.isBlock} 
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" title="Opcional">Teléfono / WhatsApp</label>
                <input 
                  type="text" 
                  name="clientPhone" 
                  className="form-input" 
                  placeholder="+569..."
                  value={formData.clientPhone} 
                  onChange={handleChange} 
                />
              </div>
            </div>
          )}

          {!formData.isBlock && (
            <>
              <div className="form-row guests-row">
                <div className="form-group">
                  <label className="form-label">Adultos</label>
                  <input 
                    type="number" 
                    name="adults" 
                    min="1" 
                    className="form-input" 
                    value={formData.adults} 
                    onChange={handleChange} 
                    required={!formData.isBlock} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" title={`7 a 15 años ($${prices?.child?.toLocaleString('es-CL')})`}>Niños (7-15)</label>
                  <input 
                    type="number" 
                    name="childrenCount" 
                    min="0" 
                    className="form-input" 
                    value={formData.childrenCount} 
                    onChange={handleChange} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" title="Menores de 7 años (Gratis)">Bebés (&lt;7)</label>
                  <input 
                    type="number" 
                    name="babiesCount" 
                    min="0" 
                    className="form-input" 
                    value={formData.babiesCount} 
                    onChange={handleChange} 
                  />
                </div>
              </div>

              <div className="form-row" style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" title="Opcional">Vuelo Ingreso (Ida)</label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="radio" name="flightIn" value="LA841" checked={formData.flightIn === 'LA841'} onChange={handleChange} /> LA841
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="radio" name="flightIn" value="LA843" checked={formData.flightIn === 'LA843'} onChange={handleChange} /> LA843
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="radio" name="flightIn" value="" checked={!formData.flightIn} onChange={handleChange} /> Ninguno
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" title="Opcional">Vuelo Salida (Regreso)</label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="radio" name="flightOut" value="LA842" checked={formData.flightOut === 'LA842'} onChange={handleChange} /> LA842
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="radio" name="flightOut" value="LA844" checked={formData.flightOut === 'LA844'} onChange={handleChange} /> LA844
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="radio" name="flightOut" value="" checked={!formData.flightOut} onChange={handleChange} /> Ninguno
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                <label className="form-label" style={{ fontSize: '1.1rem' }}>Notas de la Reserva</label>
                <textarea 
                  className="form-input" 
                  name="notes"
                  rows={3}
                  value={formData.notes} 
                  onChange={handleChange} 
                  placeholder="Detalles adicionales, extras, peticiones del pasajero..."
                />
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                <label className="form-label" style={{ fontSize: '1.1rem' }}>Precio Total Negociado ($)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}
                  value={totalCost} 
                  onChange={e => setTotalCost(Number(e.target.value))} 
                  required 
                />
                
                {formData.startDate && formData.endDate && (() => {
                  const s = parseSafeDate(formData.startDate);
                  const e = parseSafeDate(formData.endDate);
                  if (s >= e) return null;
                  const n = Math.max(1, Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)));
                  const isCustom = totalCost !== lastCalculatedCost;
                  return (
                    <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.5rem' }}>
                      Cálculo automático: <strong>{n} noches</strong> x {Number(formData.adults)+Number(formData.childrenCount)} pers. = <strong>${lastCalculatedCost.toLocaleString('es-CL')}</strong>
                      {isCustom && (
                        <div style={{ marginTop: '4px', color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🏷️ Tarifa manual / descuento activo</span>
                          <button type="button" onClick={() => setTotalCost(lastCalculatedCost)} className="btn btn-sm btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
                            Restaurar precio de lista
                          </button>
                        </div>
                      )}
                    </small>
                  );
                })()}
              </div>

              <div className="form-row" style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Abono Realizado ($)</span>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)' }}>
                      <input 
                        type="checkbox" 
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, depositAmount: Math.round(totalCost * 0.5) }));
                          } else {
                            setFormData(prev => ({ ...prev, depositAmount: 0 }));
                          }
                        }}
                      />
                      50% Abono
                    </label>
                  </label>
                  <input 
                    type="number" 
                    name="depositAmount" 
                    className="form-input" 
                    value={formData.depositAmount} 
                    onChange={handleChange} 
                    min="0"
                  />
                  {formData.depositAmount > 0 && totalCost > 0 && (
                    <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.5rem' }}>
                      Saldo Pendiente: <strong style={{ color: 'var(--danger)' }}>${(totalCost - formData.depositAmount).toLocaleString('es-CL')}</strong>
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Medio de Pago</label>
                  <select 
                    name="paymentMethod" 
                    className="form-input" 
                    value={formData.paymentMethod} 
                    onChange={handleChange}
                  >
                    <option value="">Seleccione...</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                    <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                    <option value="Airbnb">Airbnb</option>
                    <option value="Booking">Booking</option>
                    <option value="Expedia">Expedia</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}>
                  <input 
                    type="checkbox" 
                    checked={carData.hasCar} 
                    onChange={e => {
                       const checked = e.target.checked;
                       setCarData(prev => ({ ...prev, hasCar: checked, carTotalCost: checked && prev.carTotalCost === 0 ? 0 : prev.carTotalCost }));
                    }} 
                  />
                  🚗 Vincular Arriendo de Vehículo
                </label>

                {carData.hasCar && (
                  <div style={{ marginTop: '1rem', background: 'rgba(59, 130, 246, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <div className="form-group">
                      <label className="form-label">Vehículo</label>
                      <select 
                        className="form-input" 
                        value={carData.carId} 
                        onChange={e => setCarData(prev => ({ ...prev, carId: e.target.value, carTotalCost: 0 }))}
                        required={carData.hasCar}
                      >
                        <option value="">Seleccione un vehículo...</option>
                        {cars.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.plate}) - ${c.dailyRate}/día</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row" style={{ marginTop: '1rem' }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Duración del Arriendo</label>
                        <select 
                          className="form-input"
                          value={carData.isFullStay ? 'full' : 'specific'}
                          onChange={e => {
                            const isFull = e.target.value === 'full';
                            setCarData(prev => ({ 
                              ...prev, 
                              isFullStay: isFull, 
                              carTotalCost: 0,
                              startDate: isFull ? '' : formData.startDate,
                              endDate: isFull ? '' : formData.endDate
                            }));
                          }}
                        >
                          <option value="full">Estadía Completa de la Cabaña</option>
                          <option value="specific">Fechas Específicas</option>
                        </select>
                      </div>
                    </div>

                    {!carData.isFullStay && (
                      <div className="form-row" style={{ marginTop: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Desde</label>
                          <input 
                            type="date" 
                            className="form-input" 
                            value={carData.startDate} 
                            onChange={e => setCarData(prev => ({ ...prev, startDate: e.target.value, carTotalCost: 0 }))}
                            min={formData.startDate}
                            max={formData.endDate}
                            required={!carData.isFullStay}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Hasta</label>
                          <input 
                            type="date" 
                            className="form-input" 
                            value={carData.endDate} 
                            onChange={e => setCarData(prev => ({ ...prev, endDate: e.target.value, carTotalCost: 0 }))}
                            min={formData.startDate}
                            max={formData.endDate}
                            required={!carData.isFullStay}
                          />
                        </div>
                      </div>
                    )}

                    <div className="form-row" style={{ marginTop: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Total Arriendo Auto ($)</label>
                        <input 
                          type="number" 
                          className="form-input" 
                          value={carData.carTotalCost} 
                          onChange={e => setCarData(prev => ({ ...prev, carTotalCost: Number(e.target.value) }))}
                          required={carData.hasCar}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>Abono Auto ($)</span>
                          <label style={{ fontSize: '0.8rem', fontWeight: 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)' }}>
                            <input 
                              type="checkbox" 
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCarData(prev => ({ ...prev, carDepositAmount: Math.round(carData.carTotalCost * 0.5) }));
                                } else {
                                  setCarData(prev => ({ ...prev, carDepositAmount: 0 }));
                                }
                              }}
                            />
                            50% Abono
                          </label>
                        </label>
                        <input 
                          type="number" 
                          className="form-input" 
                          value={carData.carDepositAmount} 
                          onChange={e => setCarData(prev => ({ ...prev, carDepositAmount: Number(e.target.value) }))}
                        />
                        {carData.carDepositAmount > 0 && carData.carTotalCost > 0 && (
                          <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.5rem' }}>
                            Saldo Pendiente Auto: <strong style={{ color: 'var(--danger)' }}>${(carData.carTotalCost - carData.carDepositAmount).toLocaleString('es-CL')}</strong>
                          </small>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Medio de Pago (Auto)</label>
                        <select 
                          name="carPaymentMethod" 
                          className="form-input" 
                          value={carData.carPaymentMethod} 
                          onChange={e => setCarData(prev => ({ ...prev, carPaymentMethod: e.target.value }))}
                        >
                          <option value="">Seleccione...</option>
                          <option value="Transferencia">Transferencia</option>
                          <option value="Efectivo">Efectivo</option>
                          <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                          <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!formData.isBlock && (
            <div style={{ marginTop: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Resumen de la Reserva</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                <span>Total Cabaña:</span>
                <strong>${totalCost.toLocaleString('es-CL')}</strong>
              </div>
              {carData.hasCar && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                  <span>Total Vehículo:</span>
                  <strong>${carData.carTotalCost.toLocaleString('es-CL')}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)', color: 'var(--success)' }}>
                <span><strong>Total General:</strong></span>
                <strong>${(totalCost + (carData.hasCar ? carData.carTotalCost : 0)).toLocaleString('es-CL')}</strong>
              </div>
            </div>
          )}

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '1.5rem' }}>
            <div style={{ flex: 1 }}>
              {!formData.isBlock && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '5px' }} 
                  onClick={handleGenerateCarta}
                  title="Ir a generar Carta de Invitación (Los datos actuales se transferirán)"
                >
                  <FileText size={16} /> Carta
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReservationModal;
