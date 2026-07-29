import { useState, useMemo, useRef } from 'react';
import { useStore } from '../store/useStore';
import { BarChart3, Filter, Download, Home, Car, Compass, DollarSign } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { parseSafeDate, formatSafeDate } from '../utils/dateUtils';
import './Reports.css';

const Reports = () => {
  const { reservations, cabins, carReservations, cars, tourReservations, tours } = useStore();
  
  // Mes y Año actuales por defecto
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const reportRef = useRef(null);

  const months = [
    { id: 'all', name: 'Todos los meses' },
    { id: '0', name: 'Enero' }, { id: '1', name: 'Febrero' }, { id: '2', name: 'Marzo' },
    { id: '3', name: 'Abril' }, { id: '4', name: 'Mayo' }, { id: '5', name: 'Junio' },
    { id: '6', name: 'Julio' }, { id: '7', name: 'Agosto' }, { id: '8', name: 'Septiembre' },
    { id: '9', name: 'Octubre' }, { id: '10', name: 'Noviembre' }, { id: '11', name: 'Diciembre' }
  ];

  // 1. Filtrar Cabañas por Mes y Año
  const filteredReservations = useMemo(() => {
    let results = reservations;

    if (selectedMonth !== 'all') {
      results = results.filter(res => {
        const d = parseSafeDate(res.startDate);
        return d.getMonth().toString() === selectedMonth && d.getFullYear().toString() === selectedYear;
      });
    }

    return results.filter(res => res.status !== 'blocked');
  }, [reservations, selectedMonth, selectedYear]);

  // 2. Filtrar Vehículos por Mes y Año
  const filteredCarReservations = useMemo(() => {
    let results = carReservations;
    if (selectedMonth !== 'all') {
      results = results.filter(res => {
        const d = parseSafeDate(res.startDate);
        return d.getMonth().toString() === selectedMonth && d.getFullYear().toString() === selectedYear;
      });
    }
    return results.filter(res => res.status === 'confirmed');
  }, [carReservations, selectedMonth, selectedYear]);

  // 3. Filtrar Tours por Mes y Año
  const filteredTourReservations = useMemo(() => {
    let results = tourReservations;
    if (selectedMonth !== 'all') {
      results = results.filter(res => {
        const d = parseSafeDate(res.date);
        return d.getMonth().toString() === selectedMonth && d.getFullYear().toString() === selectedYear;
      });
    }
    return results.filter(res => res.status !== 'cancelled');
  }, [tourReservations, selectedMonth, selectedYear]);

  // Cálculos de Ingresos por área
  const totalIncome = filteredReservations.reduce((acc, res) => acc + Number(res.totalCost), 0);
  const totalCarIncome = filteredCarReservations.reduce((acc, res) => acc + Number(res.totalCost), 0);
  const totalTourIncome = filteredTourReservations.reduce((acc, res) => acc + Number(res.totalCost), 0);

  const grandTotalIncome = totalIncome + totalCarIncome + totalTourIncome;

  // Desglose por Vehículo
  const carIncomeByCar = cars.map(car => {
    const resForCar = filteredCarReservations.filter(r => r.carId === car.id);
    return {
      car,
      total: resForCar.reduce((acc, r) => acc + Number(r.totalCost), 0),
      count: resForCar.length
    };
  }).filter(c => c.total > 0 || c.count > 0);

  // Desglose por Tour
  const tourIncomeByTour = tours.map(tour => {
    const resForTour = filteredTourReservations.filter(r => r.tourId === tour.id);
    return {
      tour,
      total: resForTour.reduce((acc, r) => acc + Number(r.totalCost), 0),
      paxTotal: resForTour.reduce((acc, r) => acc + Number(r.paxCount || 1), 0),
      count: resForTour.length
    };
  }).filter(t => t.total > 0 || t.count > 0);

  const handleExportPDF = () => {
    const element = reportRef.current;
    
    const monthName = months.find(m => m.id === selectedMonth)?.name || 'General';
    const opt = {
      margin: [0.4, 0.4, 0.4, 0.4],
      filename: `Reporte_Consolidado_${monthName}_${selectedYear}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="reports-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Reportes y Analítica Mensual</h1>
          <p className="text-secondary">Consolidado de ingresos generales: Cabañas, Vehículos y Tours.</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={handleExportPDF} 
          disabled={filteredReservations.length === 0 && filteredCarReservations.length === 0 && filteredTourReservations.length === 0}
        >
          <Download size={20} /> Exportar Reporte a PDF
        </button>
      </div>

      {/* Controles de Filtro por Mes y Año */}
      <div className="card glass-panel filter-section" style={{ marginBottom: '1.5rem' }}>
        <div className="filter-header">
          <Filter size={20} />
          <h3>Filtro por Período Mensual</h3>
        </div>
        
        <div className="filter-controls" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', maxWidth: '500px' }}>
          <div className="form-group" style={{ flex: '1.5' }}>
            <label className="form-label">Mes:</label>
            <select className="form-input" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              {months.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ flex: '1' }}>
            <label className="form-label">Año:</label>
            <input 
              type="number" 
              className="form-input" 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)} 
              min="2020" 
              max="2100" 
            />
          </div>
        </div>
      </div>

      {/* Tarjetas de Resumen Consolidado */}
      <div className="report-results" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #556B2F' }}>
          <div className="stat-icon" style={{ color: '#556B2F', background: 'rgba(85,107,47,0.1)' }}><Home size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Ingresos Cabañas</span>
            <h2 className="stat-value" style={{ color: '#556B2F' }}>${totalIncome.toLocaleString('es-CL')}</h2>
            <small style={{ color: 'var(--text-secondary)' }}>{filteredReservations.length} estadías</small>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #2980b9' }}>
          <div className="stat-icon" style={{ color: '#2980b9', background: 'rgba(41,128,185,0.1)' }}><Car size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Ingresos Vehículos</span>
            <h2 className="stat-value" style={{ color: '#2980b9' }}>${totalCarIncome.toLocaleString('es-CL')}</h2>
            <small style={{ color: 'var(--text-secondary)' }}>{filteredCarReservations.length} arriendos</small>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #8e44ad' }}>
          <div className="stat-icon" style={{ color: '#8e44ad', background: 'rgba(142,68,173,0.1)' }}><Compass size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Ingresos Tours</span>
            <h2 className="stat-value" style={{ color: '#8e44ad' }}>${totalTourIncome.toLocaleString('es-CL')}</h2>
            <small style={{ color: 'var(--text-secondary)' }}>{filteredTourReservations.length} salidas</small>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #27ae60', background: 'linear-gradient(135deg, rgba(39,174,96,0.05), transparent)' }}>
          <div className="stat-icon" style={{ color: '#27ae60', background: 'rgba(39,174,96,0.15)' }}><DollarSign size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Consolidado Mes</span>
            <h2 className="stat-value text-success" style={{ fontSize: '1.6rem' }}>${grandTotalIncome.toLocaleString('es-CL')}</h2>
            <small style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>Ingresos Totales</small>
          </div>
        </div>
      </div>

      {/* Contenedor del PDF Imprimible */}
      <div className="card glass-panel" ref={reportRef} style={{ background: '#fff', color: '#333', padding: '1.5rem' }}>
        {/* Encabezado PDF */}
        <div style={{ marginBottom: '1.5rem', borderBottom: '2px solid #2c4c3b', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ color: '#2c4c3b', margin: '0 0 0.25rem 0' }}>Reporte Consolidado Mensual de Operaciones</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
              Período: <strong>{selectedMonth === 'all' ? 'Histórico Completo' : `${months.find(m => m.id === selectedMonth)?.name} ${selectedYear}`}</strong>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ margin: 0, color: '#16a34a', fontSize: '1.4rem' }}>
              Total Período: ${grandTotalIncome.toLocaleString('es-CL')}
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Cabañas: ${totalIncome.toLocaleString('es-CL')} | Autos: ${totalCarIncome.toLocaleString('es-CL')} | Tours: ${totalTourIncome.toLocaleString('es-CL')}
            </span>
          </div>
        </div>

        {/* 1. SECCIÓN CABAÑAS */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#2c4c3b', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>🏠 Estadías y Reservas de Cabañas</span>
            <span style={{ fontSize: '0.9rem', color: '#556B2F' }}>Subtotal: ${totalIncome.toLocaleString('es-CL')} ({filteredReservations.length} estadías)</span>
          </h3>

          {filteredReservations.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>No hay reservas de cabañas registradas en este período.</p>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Cliente</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Cabaña</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Fechas Estadía</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Vuelos (In / Out)</th>
                    <th style={{ padding: '8px 12px', color: '#475569', textAlign: 'center' }}>Pax (A/N/B)</th>
                    <th style={{ padding: '8px 12px', color: '#475569', textAlign: 'right' }}>Total ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReservations.map(res => {
                    const cabin = cabins.find(c => c.id === res.cabinId);
                    return (
                      <tr key={res.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{res.clientName}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: cabin?.color ? `${cabin.color}20` : '#e2e8f0', color: cabin?.color || '#334155', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {cabin?.name || 'Cabaña'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#475569' }}>
                          {formatSafeDate(res.startDate, 'dd/MM/yyyy')} al {formatSafeDate(res.endDate, 'dd/MM/yyyy')}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>
                          In: <strong>{res.flightIn || '--'}</strong> | Out: <strong>{res.flightOut || '--'}</strong>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {res.adults || 0} / {res.childrenCount || 0} / {res.babiesCount || 0}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>
                          ${Number(res.totalCost).toLocaleString('es-CL')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 2. SECCIÓN VEHÍCULOS */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#1e3a8a', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>🚗 Arriendos de Vehículos</span>
            <span style={{ fontSize: '0.9rem', color: '#2980b9' }}>Subtotal: ${totalCarIncome.toLocaleString('es-CL')} ({filteredCarReservations.length} arriendos)</span>
          </h3>

          {carIncomeByCar.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              {carIncomeByCar.map(item => (
                <div key={item.car.id} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', display: 'block' }}>{item.car.name} ({item.car.plate})</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.count} Arriendos</span>
                  <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#2980b9', display: 'block', marginTop: '2px' }}>${item.total.toLocaleString('es-CL')}</span>
                </div>
              ))}
            </div>
          )}

          {filteredCarReservations.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>No hay arriendos de vehículos registrados en este período.</p>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Cliente</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Vehículo</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Retiro</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Devolución</th>
                    <th style={{ padding: '8px 12px', color: '#475569', textAlign: 'right' }}>Total ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCarReservations.map(res => {
                    const car = cars.find(c => c.id === res.carId);
                    return (
                      <tr key={res.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{res.clientName}</td>
                        <td style={{ padding: '8px 12px' }}>{car ? `${car.name} (${car.plate})` : 'Vehículo'}</td>
                        <td style={{ padding: '8px 12px', color: '#475569' }}>{formatSafeDate(res.startDate, 'dd/MM/yyyy')}</td>
                        <td style={{ padding: '8px 12px', color: '#475569' }}>{formatSafeDate(res.endDate, 'dd/MM/yyyy')}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: '#2980b9' }}>
                          ${Number(res.totalCost).toLocaleString('es-CL')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 3. SECCIÓN TOURS */}
        <div>
          <h3 style={{ color: '#581c87', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>🧭 Tours y Excursiones</span>
            <span style={{ fontSize: '0.9rem', color: '#8e44ad' }}>Subtotal: ${totalTourIncome.toLocaleString('es-CL')} ({filteredTourReservations.length} salidas)</span>
          </h3>

          {tourIncomeByTour.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              {tourIncomeByTour.map(item => (
                <div key={item.tour.id} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', display: 'block' }}>{item.tour.name}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.count} Salidas ({item.paxTotal} Pasajeros)</span>
                  <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#8e44ad', display: 'block', marginTop: '2px' }}>${item.total.toLocaleString('es-CL')}</span>
                </div>
              ))}
            </div>
          )}

          {filteredTourReservations.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>No hay reservas de tours registradas en este período.</p>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Cliente</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Tour Contratado</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Fecha y Hora</th>
                    <th style={{ padding: '8px 12px', color: '#475569', textAlign: 'center' }}>Pasajeros</th>
                    <th style={{ padding: '8px 12px', color: '#475569', textAlign: 'right' }}>Total ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTourReservations.map(res => {
                    const tour = tours.find(t => t.id === res.tourId);
                    return (
                      <tr key={res.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{res.clientName}</td>
                        <td style={{ padding: '8px 12px' }}>{tour ? tour.name : 'Tour'}</td>
                        <td style={{ padding: '8px 12px', color: '#475569' }}>
                          {formatSafeDate(res.date, 'dd/MM/yyyy')} {res.time ? `(${res.time})` : ''}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>{res.paxCount || 1} Pax</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: '#8e44ad' }}>
                          ${Number(res.totalCost).toLocaleString('es-CL')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
