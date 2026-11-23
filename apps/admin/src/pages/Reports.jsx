import { useState, useMemo, useRef } from 'react';
import { useStore } from '../store/useStore';
import { BarChart3, Filter, Download, Home, Compass, DollarSign } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { parseSafeDate, formatSafeDate } from '../utils/dateUtils';
import './Reports.css';

const Reports = () => {
  const { reservations, cabins, tourReservations, tours } = useStore();
  
  // Filtros de segmento y fecha
  const [filterType, setFilterType] = useState('all'); // 'all', 'owner', 'cabin'
  const [selectedFilter, setSelectedFilter] = useState('all');
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

  // Función auxiliar para obtener el dueño asignado según la estructura oficial:
  // - Cabaña Grande (id 1) y Cabaña Pequeña (id 2) -> Dueño 1
  // - Cabañas Medianas 1 y 2 (id 3 y 4) -> Dueño 2
  const getCabinOwner = (cabin) => {
    if (!cabin) return 'Dueño 1';
    const cId = String(cabin.id);
    if (cId === '1' || cId === '2' || cabin.name?.toLowerCase().includes('grande') || cabin.name?.toLowerCase().includes('pequeña')) {
      return 'Dueño 1';
    }
    if (cId === '3' || cId === '4' || cabin.name?.toLowerCase().includes('mediana')) {
      return 'Dueño 2';
    }
    return cabin.owner || 'Dueño 1';
  };

  // Lista única de Dueños/Propietarios
  const owners = useMemo(() => {
    const list = Array.from(new Set(cabins.map(c => getCabinOwner(c))));
    return list.length > 0 ? list : ['Dueño 1', 'Dueño 2'];
  }, [cabins]);

  // 1. Filtrar Cabañas por Mes, Año, Dueño y Cabaña (Ordenadas por fecha de entrada 'startDate' de menor a mayor)
  const filteredReservations = useMemo(() => {
    let results = reservations;

    if (selectedMonth !== 'all') {
      results = results.filter(res => {
        const d = parseSafeDate(res.startDate);
        return d.getMonth().toString() === selectedMonth && d.getFullYear().toString() === selectedYear;
      });
    }

    if (filterType === 'cabin' && selectedFilter !== 'all') {
      results = results.filter(res => String(res.cabinId) === String(selectedFilter));
    } else if (filterType === 'owner' && selectedFilter !== 'all') {
      results = results.filter(res => {
        const cabin = cabins.find(c => String(c.id) === String(res.cabinId));
        return getCabinOwner(cabin) === selectedFilter;
      });
    }

    const activeRes = results.filter(res => res.status !== 'blocked');

    // Ordenar de menor a mayor por fecha de llegada (Check-In)
    return [...activeRes].sort((a, b) => {
      const dA = parseSafeDate(a.startDate).getTime();
      const dB = parseSafeDate(b.startDate).getTime();
      return dA - dB;
    });
  }, [reservations, cabins, selectedMonth, selectedYear, filterType, selectedFilter]);

  // 2. Filtrar Tours por Mes y Año (Ordenados por fecha de menor a mayor)
  const filteredTourReservations = useMemo(() => {
    let results = tourReservations || [];
    if (selectedMonth !== 'all') {
      results = results.filter(res => {
        const d = parseSafeDate(res.date);
        return d.getMonth().toString() === selectedMonth && d.getFullYear().toString() === selectedYear;
      });
    }
    const activeRes = results.filter(res => res.status !== 'cancelled');

    return [...activeRes].sort((a, b) => {
      const dA = parseSafeDate(a.date).getTime();
      const dB = parseSafeDate(b.date).getTime();
      return dA - dB;
    });
  }, [tourReservations, selectedMonth, selectedYear]);

  // Cálculos de Ingresos por área
  const totalIncome = filteredReservations.reduce((acc, res) => acc + Number(res.totalCost), 0);
  const totalTourIncome = filteredTourReservations.reduce((acc, res) => acc + Number(res.totalCost), 0);

  const grandTotalIncome = totalIncome + totalTourIncome;

  // Exportar a PDF
  const handleExportPDF = () => {
    const element = reportRef.current;
    const monthName = months.find(m => m.id === selectedMonth)?.name || 'General';
    
    let segmentLabel = 'Consolidado';
    if (filterType === 'owner') {
      segmentLabel = `Dueno_${selectedFilter === 'all' ? 'Todos' : selectedFilter.replace(/\s+/g, '_')}`;
    } else if (filterType === 'cabin') {
      const selectedCabin = cabins.find(c => String(c.id) === String(selectedFilter));
      segmentLabel = `Cabana_${selectedFilter === 'all' ? 'Todas' : selectedCabin?.name.replace(/\s+/g, '_') || selectedFilter}`;
    }

    const opt = {
      margin: [0.4, 0.4, 0.4, 0.4],
      filename: `Reporte_${segmentLabel}_${monthName}_${selectedYear}.pdf`,
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
          <h1>Reportes y Analítica</h1>
          <p className="text-secondary">Informes de ingresos segmentados por Dueño y Cabañas.</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={handleExportPDF} 
          disabled={filteredReservations.length === 0 && filteredTourReservations.length === 0}
        >
          <Download size={20} /> Exportar Reporte a PDF
        </button>
      </div>

      {/* Controles de Filtros */}
      <div className="card glass-panel filter-section" style={{ marginBottom: '1.5rem' }}>
        <div className="filter-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Filter size={20} color="var(--accent-primary)" />
          <h3 style={{ margin: 0 }}>Filtros de Reporte y Segmentación</h3>
        </div>
        
        <div className="filter-controls" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1', minWidth: '160px' }}>
            <label className="form-label">Segmentar por:</label>
            <select 
              className="form-input" 
              value={filterType} 
              onChange={(e) => {
                setFilterType(e.target.value);
                setSelectedFilter('all');
              }}
            >
              <option value="all">Consolidado General</option>
              <option value="owner">Por Dueño / Propietario</option>
              <option value="cabin">Por Cabaña</option>
            </select>
          </div>

          {filterType !== 'all' && (
            <div className="form-group" style={{ flex: '1.5', minWidth: '180px' }}>
              <label className="form-label">Seleccionar {filterType === 'owner' ? 'Dueño' : 'Cabaña'}:</label>
              <select 
                className="form-input" 
                value={selectedFilter} 
                onChange={(e) => setSelectedFilter(e.target.value)}
              >
                <option value="all">Todos los {filterType === 'owner' ? 'dueños' : 'alojamientos'}</option>
                {filterType === 'owner' ? (
                  owners.map(o => <option key={o} value={o}>{o}</option>)
                ) : (
                  cabins.map(c => <option key={c.id} value={c.id}>{c.name} ({getCabinOwner(c)})</option>)
                )}
              </select>
            </div>
          )}

          <div className="form-group" style={{ flex: '1', minWidth: '140px' }}>
            <label className="form-label">Mes:</label>
            <select className="form-input" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              {months.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ flex: '0.8', minWidth: '100px' }}>
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

        {filteredTourReservations.length > 0 && (
          <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #8e44ad' }}>
            <div className="stat-icon" style={{ color: '#8e44ad', background: 'rgba(142,68,173,0.1)' }}><Compass size={24} /></div>
            <div className="stat-info">
              <span className="stat-label">Ingresos Tours</span>
              <h2 className="stat-value" style={{ color: '#8e44ad' }}>${totalTourIncome.toLocaleString('es-CL')}</h2>
              <small style={{ color: 'var(--text-secondary)' }}>{filteredTourReservations.length} salidas</small>
            </div>
          </div>
        )}

        <div className="stat-card glass-panel" style={{ borderLeft: '4px solid #27ae60', background: 'linear-gradient(135deg, rgba(39,174,96,0.05), transparent)' }}>
          <div className="stat-icon" style={{ color: '#27ae60', background: 'rgba(39,174,96,0.15)' }}><DollarSign size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Filtrado</span>
            <h2 className="stat-value text-success" style={{ fontSize: '1.6rem' }}>${grandTotalIncome.toLocaleString('es-CL')}</h2>
            <small style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>Ingresos Período</small>
          </div>
        </div>
      </div>

      {/* Contenedor del PDF Imprimible */}
      <div className="card glass-panel" ref={reportRef} style={{ background: '#fff', color: '#333', padding: '1.5rem' }}>
        {/* Encabezado PDF */}
        <div style={{ marginBottom: '1.5rem', borderBottom: '2px solid #2c4c3b', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ color: '#2c4c3b', margin: '0 0 0.25rem 0' }}>Reporte Operativo y Financiero de Cabañas</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
              Segmento: <strong>
                {filterType === 'all' 
                  ? 'Consolidado General' 
                  : filterType === 'owner' 
                    ? `Por Dueño (${selectedFilter === 'all' ? 'Todos los dueños' : selectedFilter})`
                    : `Por Cabaña (${selectedFilter === 'all' ? 'Todas' : cabins.find(c => String(c.id) === String(selectedFilter))?.name || selectedFilter})`
                }
              </strong> | Período: <strong>{selectedMonth === 'all' ? 'Histórico Completo' : `${months.find(m => m.id === selectedMonth)?.name} ${selectedYear}`}</strong>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ margin: 0, color: '#16a34a', fontSize: '1.4rem' }}>
              Total: ${grandTotalIncome.toLocaleString('es-CL')}
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Cabañas: ${totalIncome.toLocaleString('es-CL')} {totalTourIncome > 0 ? `| Tours: $${totalTourIncome.toLocaleString('es-CL')}` : ''}
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
            <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>No hay reservas de cabañas registradas en este período/segmento.</p>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Cliente</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Cabaña</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Propietario / Dueño</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Check-In (Llegada)</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Check-Out (Salida)</th>
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
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>
                          {getCabinOwner(cabin)}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#16a34a', fontWeight: 'bold' }}>
                          {formatSafeDate(res.startDate, 'dd/MM/yyyy')}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#dc2626', fontWeight: 'bold' }}>
                          {formatSafeDate(res.endDate, 'dd/MM/yyyy')}
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

        {/* 2. SECCIÓN TOURS */}
        {filteredTourReservations.length > 0 && (
          <div>
            <h3 style={{ color: '#8e44ad', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>🏔️ Tours y Excursiones Guiadas</span>
              <span style={{ fontSize: '0.9rem' }}>Subtotal: ${totalTourIncome.toLocaleString('es-CL')} ({filteredTourReservations.length} salidas)</span>
            </h3>

            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Cliente</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Tour</th>
                    <th style={{ padding: '8px 12px', color: '#475569' }}>Fecha Tour</th>
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
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: 'rgba(142,68,173,0.1)', color: '#8e44ad', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {tour?.name || 'Tour'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#475569' }}>
                          {formatSafeDate(res.date, 'dd/MM/yyyy')}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {res.paxCount || 1} pax
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: '#8e44ad' }}>
                          ${Number(res.totalCost).toLocaleString('es-CL')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
