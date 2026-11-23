import { useState, useRef } from 'react';
import { Download, Users, FileText, Plane, PlaneTakeoff, PlaneLanding, Mail, Trash2, Plus, Share2, Tent } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { useStore, getSupabase } from '../store/useStore';
import { generateWhatsAppLink, generateInvitationMessage } from '../utils/whatsapp';
import { formatSafeDate } from '../utils/dateUtils';
import './PassengerRegistration.css';

export default function PassengerRegistration() {
  const location = useLocation();
  const reservationData = location.state?.reservation;

  const [rawText, setRawText] = useState('');
  
  // Parsed Form State - Inicializado con datos de la reserva si existen
  const [checkIn, setCheckIn] = useState(reservationData?.startDate || '');
  const [checkOut, setCheckOut] = useState(reservationData?.endDate || '');
  const [flightIn, setFlightIn] = useState(reservationData?.flightIn || '');
  const [flightOut, setFlightOut] = useState(reservationData?.flightOut || '');
  const [email, setEmail] = useState('');
  const [titular, setTitular] = useState(reservationData?.clientName || '');
  const [clientPhone, setClientPhone] = useState(reservationData?.clientPhone || '');
  const [notes, setNotes] = useState(reservationData?.notes || '');
  const [passengers, setPassengers] = useState([]);
  
  const invoiceRef = useRef(null);

  const handleParseText = () => {
    // Basic Parsing Heuristics
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let foundDates = [];
    let foundRuts = [];
    let foundEmails = [];
    let newPassengers = [];

    const rutRegex = /\b(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])\b/gi;
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi;
    const dateRegex = /\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\b/g;
    const flightRegex = /\b([A-Za-z]{0,2}\s?\d{3,4})\b/g;

    let possibleFlights = [];

    for (let i = 0; i < lines.length; i++) {
      // Limpiar prefijos de WhatsApp como "[22/5, 12:05 p.m.] Nombre:"
      let line = lines[i].replace(/^\[\d{1,2}[\/\-]\d{1,2}.*?\]\s*.*?:/i, '').trim();

      const emailsInLine = line.match(emailRegex);
      if (emailsInLine) foundEmails.push(...emailsInLine);

      const datesInLine = line.match(dateRegex);
      if (datesInLine && !/nacimiento/i.test(line)) {
        const validDates = datesInLine.filter(d => {
          const parts = d.split(/[\/\-]/);
          if (parts.length === 3 && parts[2].length === 4 && parseInt(parts[2]) < 2024) return false;
          return true;
        });
        foundDates.push(...validDates);
      }

      // Mejorar detección de vuelos: ignorar RUTs que parezcan vuelos
      const flightsInLine = line.match(flightRegex);
      if (flightsInLine) {
        const validFlights = flightsInLine.filter(f => !rutRegex.test(f) && /\d/.test(f));
        possibleFlights.push(...validFlights);
      }

      const rutsInLine = line.match(rutRegex);
      if (rutsInLine) {
        rutsInLine.forEach(rut => {
          let nameRaw = line.replace(rutRegex, '').replace(emailRegex, '').replace(dateRegex, '').trim();
          
          // Si la línea con el RUT quedó casi vacía (ej: "Rut :" -> length 5), el nombre probablemente está en la línea anterior
          const cleanedLength = nameRaw.replace(/rut|:|pasajero/gi, '').trim().length;
          if (cleanedLength < 4 && i > 0) {
            nameRaw = lines[i-1].replace(/^\[\d{1,2}[\/\-]\d{1,2}.*?\]\s*.*?:/i, '').replace(emailRegex, '').replace(dateRegex, '').trim();
          }

          // Limpiar palabras clave o ruidos
          let name = nameRaw.replace(/nombre completo/gi, '')
                            .replace(/nombre[:]?/gi, '')
                            .replace(/numero de vuelo ida/gi, '')
                            .replace(/vuelta/gi, '')
                            .replace(/rut[:]?/gi, '')
                            .replace(/pasajero[:]?/gi, '')
                            .replace(/viajo el.*$/gi, '')
                            .replace(/carnet.*$/gi, '')
                            .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '') // Eliminar caracteres especiales y números que no sean letras
                            .trim();
          
          if (name.length < 2) name = 'Pasajero Sin Nombre';
          
          newPassengers.push({ name, rut });
        });
      }
    }

    let parsedCheckIn = '';
    let parsedCheckOut = '';
    
    // Convertir de DD/MM/YYYY a YYYY-MM-DD
    const formatDateForInput = (dateStr) => {
      if (!dateStr) return '';
      const parts = dateStr.split(/[\/\-]/);
      if (parts.length >= 3) {
        let day = parts[0].padStart(2, '0');
        let month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = '20' + year;
        return `${year}-${month}-${day}`;
      }
      return dateStr;
    };

    if (!checkIn && foundDates.length >= 1) setCheckIn(parsedCheckIn);
    if (!checkOut && foundDates.length >= 2) setCheckOut(parsedCheckOut);
    
    if (foundEmails.length > 0) setEmail(foundEmails[0]);

    // Extraer vuelos del texto si es que hay palabras clave (vuelo, ida, vuelta)
    const combinedText = lines.join(' ').toLowerCase();
    const flightMatches = combinedText.match(/(?:vuelo|ida|vuelta).*?\b([A-Za-z]{0,2}\s?\d{3,4})\b/g);
    
    if (flightMatches) {
       flightMatches.forEach(fm => {
          const numMatch = fm.match(/\b([A-Za-z]{0,2}\s?\d{3,4})\b/);
          if (numMatch) {
             const fNum = numMatch[1].replace(/\s/g, '').toUpperCase();
             if (fm.includes('ida') || fm.includes('llegada')) setFlightIn(fNum);
             else if (fm.includes('vuelta') || fm.includes('salida')) setFlightOut(fNum);
          }
       });
    } else {
      // Fallback
      if (!flightIn && possibleFlights.length >= 1) setFlightIn(possibleFlights[0].toUpperCase());
      if (!flightOut && possibleFlights.length >= 2) setFlightOut(possibleFlights[possibleFlights.length - 1].toUpperCase());
    }

    if (newPassengers.length > 0) {
      setPassengers(newPassengers);
    }
  };

  const addPassenger = () => {
    setPassengers([...passengers, { name: '', rut: '' }]);
  };

  const removePassenger = (index) => {
    const newP = [...passengers];
    newP.splice(index, 1);
    setPassengers(newP);
  };

  const handlePassengerChange = (index, field, value) => {
    const newP = [...passengers];
    newP[index][field] = value;
    setPassengers(newP);
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const getPdfOptions = () => ({
    margin: [0, 0, 0, 0],
    filename: `CARTA_DE_INVITACION_${titular ? titular.toUpperCase().replace(/\s+/g, '_') : 'SIN_NOMBRE'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#FAF7F2' },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  });

  const handleExportPDF = () => {
    setIsExporting(true);
    setTimeout(() => {
      const element = invoiceRef.current;
      html2pdf().set(getPdfOptions()).from(element).save().then(() => {
        setIsExporting(false);
      });
    }, 150);
  };

  const handleWhatsAppInvitation = () => {
    if (!clientPhone) {
      alert("Por favor, ingresa el teléfono del cliente para enviarle la carta de invitación.");
      return;
    }
    
    setIsUploading(true);
    setIsExporting(true);
    
    setTimeout(async () => {
      try {
        const element = invoiceRef.current;
        const options = getPdfOptions();
        
        // Generar Blob
        const pdfWorker = html2pdf().set(options).from(element);
        const pdfBlob = await pdfWorker.output('blob');
        
        // 1. Descargar localmente
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = options.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);

        // 2. Subir a Supabase Storage
        const sb = getSupabase(useStore.getState().syncConfig);
        if (!sb) throw new Error("No hay conexión a Supabase.");

        const fileName = `${Date.now()}_${options.filename}`;
        const { error: uploadError } = await sb.storage
          .from('quotes') // Usamos el mismo bucket público
          .upload(fileName, pdfBlob, { contentType: 'application/pdf', cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        // 3. Obtener URL Pública
        const { data: publicUrlData } = sb.storage.from('quotes').getPublicUrl(fileName);
        const pdfPublicUrl = publicUrlData.publicUrl;

        // 4. Abrir WhatsApp
        const waMessage = generateInvitationMessage(titular, pdfPublicUrl);
        const waLink = generateWhatsAppLink(clientPhone, waMessage);
        window.open(waLink, '_blank', 'noopener,noreferrer');

      } catch (err) {
        console.error("Error al procesar la invitación:", err);
        alert(`Ocurrió un error al subir el archivo: ${err.message}`);
      } finally {
        setIsUploading(false);
        setIsExporting(false);
      }
    }, 150);
  };

  return (
    <div className="passenger-page">
      <div className="page-header">
        <h1>Registro de Pasajeros</h1>
        <p className="text-secondary">Autocompletado de Reservas y Vuelos</p>
      </div>

      <div className="content-grid">
        <div className="left-panel">
          <div className="card glass-panel" style={{ marginBottom: '2rem' }}>
            <h2><FileText size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }}/> Texto de la Reserva</h2>
            <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
              Pega aquí la información que te envía el cliente (correo, whatsapp, etc). El sistema intentará extraer los datos automáticamente.
            </p>
            <textarea
              className="form-input"
              rows={5}
              placeholder="Pega el texto aquí..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              style={{ resize: 'vertical', width: '100%' }}
            />
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={handleParseText}
              disabled={!rawText.trim()}
            >
              Analizar y Extraer Datos
            </button>
          </div>

          <div className="card glass-panel" style={{ marginBottom: '2rem' }}>
            <h2><Plane size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }}/> Detalles del Viaje</h2>
            
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group">
                <label className="form-label">Titular de la Reserva</label>
                <input type="text" className="form-input" value={titular} onChange={e => setTitular(e.target.value)} placeholder="Ej: Juan Pérez" />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono Cliente (WhatsApp)</label>
                <input type="text" className="form-input" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+56912345678" />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha Ida (Check-in)</label>
                <input type="date" className="form-input" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha Vuelta (Check-out)</label>
                <input type="date" className="form-input" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label"><PlaneLanding size={16} style={{ display: 'inline' }}/> Vuelo Llegada (Ida)</label>
                <select className="form-input" value={flightIn} onChange={e => setFlightIn(e.target.value)}>
                  <option value="">Seleccione vuelo...</option>
                  <option value="LA841">LA841</option>
                  <option value="LA843">LA843</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label"><PlaneTakeoff size={16} style={{ display: 'inline' }}/> Vuelo Salida (Vuelta)</label>
                <select className="form-input" value={flightOut} onChange={e => setFlightOut(e.target.value)}>
                  <option value="">Seleccione vuelo...</option>
                  <option value="LA842">LA842</option>
                  <option value="LA844">LA844</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label"><Mail size={16} style={{ display: 'inline' }}/> Correo de Contacto</label>
                <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notas Adicionales / Extras</label>
                <textarea 
                  className="form-input" 
                  rows={3} 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Detalles, peticiones especiales, servicios adicionales..." 
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          <div className="card glass-panel" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2><Users size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }}/> Lista de Pasajeros</h2>
              <button className="btn btn-secondary" onClick={addPassenger} style={{ padding: '6px 12px', fontSize: '0.9rem' }}>
                <Plus size={16} /> Agregar
              </button>
            </div>
            
            {passengers.length === 0 ? (
              <p className="text-secondary" style={{ fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
                No hay pasajeros agregados.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {passengers.map((p, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ flex: 2 }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={p.name} 
                        onChange={e => handlePassengerChange(index, 'name', e.target.value)} 
                        placeholder="Nombre Completo" 
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={p.rut} 
                        onChange={e => handlePassengerChange(index, 'rut', e.target.value)} 
                        placeholder="RUT" 
                      />
                    </div>
                    <button 
                      onClick={() => removePassenger(index)} 
                      className="btn-icon danger"
                      title="Eliminar"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="right-panel">
          <div style={{ width: '100%', minWidth: isExporting ? '800px' : 'auto', transition: 'min-width 0.1s' }}>
            <div className="card glass-panel invoice-preview-container" style={{ padding: 0, background: '#FAF7F2' }} ref={invoiceRef}>
              <div className="invoice-header">
                <div className="invoice-brand">
                  <Tent size={48} color="#D35400" />
                  <div>
                    <h2 className="invoice-title">CABAÑAS MANUARA</h2>
                    <div className="invoice-subtitle">CÓDIGO SERNATUR: 34494</div>
                  </div>
                </div>
                <div className="invoice-header-right">
                  <h3 className="invoice-doc-type">CONFIRMACIÓN DE RESERVA</h3>
                  <div className="invoice-date">Emitido: {formatSafeDate(new Date(), 'dd MMM yyyy')}</div>
                </div>
              </div>

              <div className="invoice-body">
                <div className="invoice-section">
                  <div className="invoice-section-title">DETALLES DE LA RESERVA</div>
                  <div className="invoice-section-content invoice-detail-grid">
                    <div className="invoice-detail-item" style={{ gridColumn: '1 / -1' }}>
                      <span className="invoice-detail-label">Titular de la Reserva</span>
                      <span className="invoice-detail-value">{titular || '—'}</span>
                    </div>
                    <div className="invoice-detail-item">
                      <span className="invoice-detail-label">Fecha de Entrada</span>
                      <span className="invoice-detail-value">{checkIn ? formatSafeDate(checkIn, 'dd MMM yyyy') : '—'}</span>
                    </div>
                    <div className="invoice-detail-item">
                      <span className="invoice-detail-label">Fecha de Salida</span>
                      <span className="invoice-detail-value">{checkOut ? formatSafeDate(checkOut, 'dd MMM yyyy') : '—'}</span>
                    </div>
                    <div className="invoice-detail-item">
                      <span className="invoice-detail-label">Vuelo de Entrada</span>
                      <span className="invoice-detail-value">{flightIn || '—'}</span>
                    </div>
                    <div className="invoice-detail-item">
                      <span className="invoice-detail-label">Vuelo de Salida</span>
                      <span className="invoice-detail-value">{flightOut || '—'}</span>
                    </div>
                  </div>
                </div>

                {notes && (
                  <div className="invoice-section">
                    <div className="invoice-section-title">NOTAS DE LA RESERVA / EXTRAS</div>
                    <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '4px', fontSize: '0.95rem', color: '#333', whiteSpace: 'pre-wrap', borderLeft: '3px solid #D35400' }}>
                      {notes}
                    </div>
                  </div>
                )}

                <div className="invoice-section">
                  <div className="invoice-section-title">LISTA DE PASAJEROS ({passengers.length})</div>
                  <table className="invoice-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>N°</th>
                        <th>Nombre Completo</th>
                        <th>RUT / Pasaporte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {passengers.length === 0 ? (
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'center', color: '#706258', padding: '2rem' }}>
                            No hay pasajeros registrados
                          </td>
                        </tr>
                      ) : (
                        passengers.map((p, idx) => (
                          <tr key={idx}>
                            <td style={{ color: '#D35400', fontWeight: 'bold' }}>{idx + 1}</td>
                            <td>{p.name || '—'}</td>
                            <td>{p.rut || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="invoice-footer">
                <p><strong>Cabañas Manuara</strong> - Isla de Pascua, Chile</p>
                <p>Contacto: cabanasmanuara@gmail.com | +56 9 8456 2244</p>
                <p style={{ marginTop: '1rem', opacity: 0.7, fontSize: '0.75rem' }}>
                  Documento generado automáticamente por Manuara App
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '1rem', width: '100%' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleExportPDF} disabled={isExporting}>
              <Download size={20} /> Guardar
            </button>
            <button 
              className="btn btn-primary" 
              style={{ flex: 1, backgroundColor: '#25D366', borderColor: '#25D366', color: 'white', opacity: isUploading ? 0.7 : 1 }}
              onClick={handleWhatsAppInvitation}
              disabled={isUploading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              {isUploading ? 'Procesando...' : 'Enviar por WhatsApp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
