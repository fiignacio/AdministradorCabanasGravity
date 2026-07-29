import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Upload, Archive, ArchiveRestore, Search, FilterX, FileText, MessageCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import ReservationModal from '../components/ReservationModal';
import WhatsAppModal from '../components/WhatsAppModal';
import { parseSafeDate, formatSafeDate } from '../utils/dateUtils';
import { calculateReservationCost } from '../utils/pricing';
import './Reservations.css';

const Reservations = () => {
  const { reservations, cabins, prices, deleteReservation, addReservation, updateReservation } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waReservation, setWaReservation] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleGenerateCarta = (res) => {
    navigate('/admin/tools/passengers', { state: { reservation: res } });
  };

  const handleAddNew = () => {
    setEditingReservation(null);
    setIsModalOpen(true);
  };

  const handleEdit = (res) => {
    setEditingReservation(res);
    setIsModalOpen(true);
  };

  const handleOpenWhatsApp = (res) => {
    setWaReservation(res);
    setWaModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta reserva de forma permanente?')) {
      deleteReservation(id);
    }
  };

  const handleToggleArchive = (res) => {
    updateReservation(res.id, { 
      status: res.status === 'archived' ? (res.isBlock ? 'blocked' : 'confirmed') : 'archived' 
    });
  };

  const getCabinName = (cabinId) => cabins.find(c => c.id === cabinId)?.name || 'Desconocida';

  // Lógica de importación
  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const dataBuffer = new Uint8Array(evt.target.result);
        // raw: true previene que XLSX corrompa las fechas de los CSV interpretándolas como formato gringo (MM/DD)
        const wb = XLSX.read(dataBuffer, { type: 'array', raw: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // raw: true evita que XLSX intente formatear fechas y devuelva los números crudos o los strings originales
        const data = XLSX.utils.sheet_to_json(ws, { raw: true });
        
        processExcelData(data);
      } catch (err) {
        console.error("Error al leer Excel", err);
        alert("Error al procesar el archivo Excel.");
      }
      e.target.value = ''; // Reset input
    };
    reader.readAsArrayBuffer(file);
  };

  const getVal = (row, exactKey) => {
    const target = exactKey.toLowerCase().replace(/[^a-z0-9]/gi, '');
    for (const k of Object.keys(row)) {
      const nk = k.toLowerCase().replace(/[^a-z0-9]/gi, '');
      if (nk === target || nk.includes(target)) {
        return row[k];
      }
    }
    return null;
  };

  const processExcelData = (data) => {
    if (data.length === 0) return alert("El archivo está vacío.");
    
    let importedCount = 0;
    data.forEach(row => {
      const clientName = getVal(row, 'nombre') || getVal(row, 'pasajero') || getVal(row, 'cliente') || 'Importado desde Excel';
      const checkInRaw = getVal(row, 'checkin') || getVal(row, 'llegada') || getVal(row, 'ingreso');
      const checkOutRaw = getVal(row, 'checkout') || getVal(row, 'salida');
      const adults = parseInt(getVal(row, 'adultos')) || 0;
      const children = parseInt(getVal(row, 'niops')) || parseInt(getVal(row, 'ni')) || parseInt(getVal(row, 'ninos')) || 0;
      const babies = parseInt(getVal(row, 'bebes')) || parseInt(getVal(row, 'beb')) || 0;
      const cabinRaw = getVal(row, 'tipodecabaa') || getVal(row, 'caba') || getVal(row, 'tipo');
      
      const rawPrice = getVal(row, 'preciototal') || getVal(row, 'precio') || getVal(row, 'costo');
      const totalCost = rawPrice ? parseFloat(String(rawPrice).replace(/\./g, '').replace(/[^0-9-]/g, '')) : 0;
      
      const rawAbono = getVal(row, 'abonopagado') || getVal(row, 'abono');
      const depositAmount = rawAbono ? parseFloat(String(rawAbono).replace(/\./g, '').replace(/[^0-9-]/g, '')) : 0;
      
      const paymentMethod = getVal(row, 'estadodepago') || getVal(row, 'mediopago') || '';
      
      const flightIn = getVal(row, 'vuelodellegada') || getVal(row, 'vuelollegada') || '';
      const flightOut = getVal(row, 'vuelodesalida') || getVal(row, 'vuelosalida') || '';

      const parseExcelDate = (raw) => {
        if (raw instanceof Date) return raw;
        if (typeof raw === 'number') {
          // Compensar la zona horaria para evitar que a la medianoche UTC se le reste un día en Chile
          const utcDate = new Date(Math.round((raw - 25569) * 86400 * 1000));
          return new Date(utcDate.getTime() + utcDate.getTimezoneOffset() * 60000 + (12 * 60 * 60 * 1000)); // +12 horas para estar seguros en el mediodía
        } else if (typeof raw === 'string') {
          const parts = raw.split(/[-/]/);
          if (parts.length === 3) {
            // asume dd/mm/yyyy
            if (parts[2].length === 4) return new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}T12:00:00`);
            return new Date(raw);
          }
        }
        return null;
      };

      const startD = parseExcelDate(checkInRaw);
      const endD = parseExcelDate(checkOutRaw);
      
      if (!startD || !endD) return; // Salta filas sin fecha válida

      // Filtrar reservas pasadas (desde abril hacia atrás)
      if (endD.getFullYear() < 2026 || (endD.getFullYear() === 2026 && endD.getMonth() <= 3)) {
        return; // Salta la fila
      }

      const startDate = formatSafeDate(startD, 'yyyy-MM-dd');
      const endDate = formatSafeDate(endD, 'yyyy-MM-dd');

      // Calcular el precio real en función de la temporada y cantidad de personas
      const calculatedCost = calculateReservationCost(startDate, endDate, adults, children, prices);
      // Usamos el precio calculado; si falla por alguna razón, usamos el del Excel
      const finalCost = calculatedCost > 0 ? calculatedCost : totalCost;

      let cabinId = cabins[0]?.id;
      if (cabinRaw) {
        const cleanRaw = String(cabinRaw).toLowerCase().replace(/[^a-z0-9]/gi, '');
        // Buscar coincidencia más larga primero para evitar que "Cabaña" coincida con cualquiera
        const sortedCabins = [...cabins].sort((a, b) => b.name.length - a.name.length);
        const match = sortedCabins.find(c => {
          const cName = c.name.toLowerCase().replace(/[^a-z0-9]/gi, '');
          // Filtramos palabras muy genéricas
          if (cName.length < 4) return false;
          return cleanRaw.includes(cName) || cName.includes(cleanRaw);
        });
        if (match) cabinId = match.id;
      }

      addReservation({
        clientName,
        cabinId,
        startDate,
        endDate,
        adults,
        childrenCount: children,
        babiesCount: babies,
        flightIn,
        flightOut,
        totalCost: finalCost,
        depositAmount,
        paymentMethod: String(paymentMethod),
        status: 'confirmed',
        isBlock: false
      });
      importedCount++;
    });
    
    alert(`Importación completada: Se procesaron y añadieron ${importedCount} reservas.`);
  };

  const displayedReservations = reservations.filter(r => {
    // 1. Filtrar por estado (Historial vs Activas)
    if (showArchived ? r.status !== 'archived' : r.status === 'archived') return false;

    // 2. Filtrar por fecha de llegada
    if (filterDate && r.startDate !== filterDate) return false;

    // 3. Filtrar por texto (Buscador)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const cabinName = getCabinName(r.cabinId).toLowerCase();
      const client = (r.clientName || '').toLowerCase();
      
      if (!client.includes(term) && !cabinName.includes(term)) {
        return false;
      }
    }
    
    return true;
  }).sort((a, b) => {
    const timeA = new Date(a.startDate).getTime();
    const timeB = new Date(b.startDate).getTime();
    return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
  });

  return (
    <div className="reservations-page">
      <div className="page-header">
        <h1>{showArchived ? 'Historial de Reservas (Archivadas)' : 'Gestión de Reservas'}</h1>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className={`btn ${showArchived ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? <ArchiveRestore size={20} /> : <Archive size={20} />}
            {showArchived ? 'Ver Activas' : 'Ver Historial'}
          </button>
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            ref={fileInputRef} 
            onChange={handleImportExcel} 
            style={{ display: 'none' }} 
          />
          <button className="btn btn-secondary" onClick={() => fileInputRef.current.click()}>
            <Upload size={20} />
            Importar Excel
          </button>
          <button className="btn btn-primary" onClick={handleAddNew}>
            <Plus size={20} />
            Nueva Reserva
          </button>
        </div>
      </div>

      <div className="card glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.5rem 1rem', flex: '1', minWidth: '250px', border: '1px solid var(--glass-border)' }}>
          <Search size={20} color="var(--text-secondary)" style={{ marginRight: '10px' }} />
          <input 
            type="text" 
            placeholder="Buscar por cliente o cabaña..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ color: 'var(--text-secondary)' }}>Llegada:</label>
          <input 
            type="date" 
            className="form-input" 
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ width: 'auto', padding: '0.5rem' }}
          />
          <select 
            className="form-input" 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value)}
            style={{ padding: '0.5rem', width: 'auto', cursor: 'pointer' }}
          >
            <option value="asc">Orden: Próximas primero</option>
            <option value="desc">Orden: Más lejanas primero</option>
          </select>
          {(searchTerm || filterDate) && (
            <button className="btn-icon" onClick={() => { setSearchTerm(''); setFilterDate(''); }} title="Limpiar filtros">
              <FilterX size={20} color="var(--danger)" />
            </button>
          )}
        </div>
      </div>

      <div className="card glass-panel table-container">
        {displayedReservations.length === 0 ? (
          <div className="empty-state">
            <p>{showArchived ? 'No hay reservas en el historial.' : 'No hay reservas registradas. ¡Crea la primera!'}</p>
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className="reservations-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Cabaña</th>
                <th>Llegada</th>
                <th>Salida</th>
                <th>Noches</th>
                <th>Huéspedes</th>
                <th>Costo Total</th>
                <th>Historial</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {displayedReservations.map(res => {
                const sDate = parseSafeDate(res.startDate);
                const eDate = parseSafeDate(res.endDate);
                const nights = Math.max(1, Math.ceil(Math.abs(eDate - sDate) / (1000 * 60 * 60 * 24)));
                
                const guestsArr = [];
                if (res.adults > 0) guestsArr.push(`${res.adults} Ad.`);
                if (res.childrenCount > 0) guestsArr.push(`${res.childrenCount} Niñ.`);
                if (res.babiesCount > 0) guestsArr.push(`${res.babiesCount} Beb.`);
                const guestsStr = guestsArr.join(', ') || '0';

                return (
                  <tr key={res.id}>
                    <td><strong>{res.clientName}</strong></td>
                    <td>{getCabinName(res.cabinId)}</td>
                    <td>{formatSafeDate(res.startDate)}</td>
                    <td>{formatSafeDate(res.endDate)}</td>
                    <td>{nights} {nights === 1 ? 'noche' : 'noches'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{guestsStr}</td>
                    <td className="price-cell">${Number(res.totalCost).toLocaleString('es-CL')}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={res.status === 'archived'} 
                        onChange={() => handleToggleArchive(res)} 
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                        title={res.status === 'archived' ? 'Restaurar a activas' : 'Mover al historial'}
                      />
                    </td>
                    <td>
                      <div className="actions" style={{ display: 'flex', gap: '0.5rem' }}>
                        {res.clientPhone && !res.isBlock && (
                          <button 
                            type="button"
                            onClick={() => handleOpenWhatsApp(res)}
                            className="btn-icon" 
                            style={{ color: '#25D366', background: 'rgba(37,211,102,0.1)' }} 
                            title="Enviar WhatsApp"
                          >
                            <MessageCircle size={18} />
                          </button>
                        )}
                        <button className="btn-icon" style={{ color: 'var(--accent-primary)', background: 'rgba(59,130,246,0.1)' }} onClick={() => handleGenerateCarta(res)} title="Carta de Invitación">
                          <FileText size={18} />
                        </button>
                        <button className="btn-icon" onClick={() => handleEdit(res)}>
                          <Edit2 size={18} />
                        </button>
                        <button className="btn-icon danger" onClick={() => handleDelete(res.id)}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <ReservationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        reservationToEdit={editingReservation}
      />

      <WhatsAppModal 
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        reservation={waReservation}
        type="cabin"
        contextName={waReservation ? getCabinName(waReservation.cabinId) : ''}
      />
    </div>
  );
};

export default Reservations;
