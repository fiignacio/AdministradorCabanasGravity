import { useState, useRef, useMemo } from 'react';
import { Download, Calendar, Users, Car, Moon, Sun } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { format, differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useStore, getSupabase } from '../store/useStore';
import { generateWhatsAppLink, generateQuoteMessage } from '../utils/whatsapp';
import { isHighSeason as isHighSeasonUtil, getHighSeasonText, getLowSeasonText } from '../utils/pricing';
import './QuoteGenerator.css';

export default function QuoteGenerator() {
  const { prices, seasonConfig } = useStore();
  
  const [dateMode, setDateMode] = useState('dates'); // 'dates' | 'season'
  const [customNights, setCustomNights] = useState(3);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(addDays(new Date(), 3));
  const [manualHighSeason, setManualHighSeason] = useState(false);
  const [titular, setTitular] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [babies, setBabies] = useState(0);

  const [includeCar, setIncludeCar] = useState(false);
  const [carDays, setCarDays] = useState(1);

  const invoiceRef = useRef(null);

  const nightsCalculated = Math.max(1, differenceInDays(endDate, startDate) || 1);
  const nights = dateMode === 'season' ? Math.max(1, Number(customNights)) : nightsCalculated;
  const totalGuests = adults + children + babies;

  // Determinar temporada (Automática por fecha o Manual por temporada)
  const isHighSeason = useMemo(() => {
    if (dateMode === 'dates') {
      return isHighSeasonUtil(startDate, seasonConfig);
    }
    return manualHighSeason;
  }, [dateMode, startDate, seasonConfig, manualHighSeason]);

  // Pricing Logic from Global Store
  let priceAdult = isHighSeason ? prices.highSeasonAdult : prices.lowSeasonAdult;

  // Descuento para grupos grandes (como en el original)
  if (totalGuests >= 10) {
    priceAdult = 25000;
  }
  const priceChild = prices.child;

  const totalAdults = adults * priceAdult * nights;
  const totalChildren = children * priceChild * nights;
  
  // Extra Car
  const carPricePerDay = carDays >= 3 ? 40000 : 45000;
  const totalCar = includeCar ? carDays * carPricePerDay : 0;

  const subtotal = totalAdults + totalChildren;
  const grandTotal = subtotal + totalCar;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(value);
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const getPdfOptions = () => ({
    margin: [0.5, 1, 0.5, 1], // Superior, Derecho, Inferior, Izquierdo
    filename: `PRESUPUESTO_CABAÑAS_MANUARA_${titular ? titular.toUpperCase().replace(/\s+/g, '_') : 'SIN_NOMBRE'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      backgroundColor: '#FAF7F2'
    },
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

  const handleWhatsAppQuote = () => {
    if (!clientPhone) {
      alert("Por favor, ingresa el teléfono del cliente para enviarle la cotización.");
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
        if (!sb) {
          throw new Error("No hay conexión a Supabase. No se pudo subir el archivo.");
        }

        const fileName = `${Date.now()}_${options.filename}`;
        const { error: uploadError } = await sb.storage
          .from('quotes')
          .upload(fileName, pdfBlob, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw uploadError;
        }

        // 3. Obtener URL Pública
        const { data: publicUrlData } = sb.storage
          .from('quotes')
          .getPublicUrl(fileName);

        const pdfPublicUrl = publicUrlData.publicUrl;

        // 4. Abrir WhatsApp
        const waMessage = generateQuoteMessage(titular, pdfPublicUrl);
        const waLink = generateWhatsAppLink(clientPhone, waMessage);
        window.open(waLink, '_blank', 'noopener,noreferrer');

      } catch (err) {
        console.error("Error al procesar la cotización:", err);
        alert(`Ocurrió un error al subir el archivo: ${err.message}`);
      } finally {
        setIsUploading(false);
        setIsExporting(false);
      }
    }, 150);
  };

  const handleStartDateChange = (e) => {
    const date = new Date(e.target.value + 'T12:00:00');
    setStartDate(date);
    if (date >= endDate) {
      setEndDate(addDays(date, 1));
    }
  };

  const handleEndDateChange = (e) => {
    const date = new Date(e.target.value + 'T12:00:00');
    if (date > startDate) {
      setEndDate(date);
    }
  };

  return (
    <div className="quote-page">
      <div className="page-header">
        <h1>Cotizador de Estadía</h1>
        <p className="text-secondary">Generador de Presupuestos en PDF</p>
      </div>

      <div className="content-grid">
        <div className="left-panel">
          
          <div className="card glass-panel" style={{ marginBottom: '1.5rem' }}>
            <h2><Calendar size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }}/> Datos de la Reserva</h2>
            
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Titular de la Reserva</label>
                <input 
                  type="text" 
                  className="form-input"
                  placeholder="Ej: Juan Pérez"
                  value={titular}
                  onChange={(e) => setTitular(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">WhatsApp (Opcional)</label>
                <input 
                  type="text" 
                  className="form-input"
                  placeholder="+569..."
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                />
              </div>
            </div>

            {/* SELECTOR DE MODO DE FECHA */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', background: 'rgba(0,0,0,0.04)', padding: '4px', borderRadius: '10px' }}>
              <button
                type="button"
                onClick={() => setDateMode('dates')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: dateMode === 'dates' ? 'var(--accent-primary)' : 'transparent',
                  color: dateMode === 'dates' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                📅 Fechas Específicas
              </button>
              <button
                type="button"
                onClick={() => setDateMode('season')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: dateMode === 'season' ? 'var(--accent-primary)' : 'transparent',
                  color: dateMode === 'season' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                ☀️ Por Temporada (Sin Fecha)
              </button>
            </div>

            {dateMode === 'dates' ? (
              <div className="form-row" style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Check-in</label>
                  <input 
                    type="date" 
                    className="form-input"
                    value={format(startDate, 'yyyy-MM-dd')}
                    onChange={handleStartDateChange}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Check-out</label>
                  <input 
                    type="date" 
                    className="form-input"
                    value={format(endDate, 'yyyy-MM-dd')}
                    onChange={handleEndDateChange}
                  />
                </div>
              </div>
            ) : (
              <div className="form-row" style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Cantidad de Noches</label>
                  <input 
                    type="number" 
                    className="form-input"
                    min={1}
                    value={customNights}
                    onChange={(e) => setCustomNights(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
              </div>
            )}

            <div className="form-group checkbox-group" style={{ marginTop: '1rem', background: isHighSeason ? 'rgba(230, 126, 34, 0.1)' : 'rgba(52, 152, 219, 0.1)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              {dateMode === 'season' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={manualHighSeason} 
                    onChange={(e) => setManualHighSeason(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  {manualHighSeason ? <Sun size={20} color="#e67e22"/> : <Moon size={20} color="#3498db"/>}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>{manualHighSeason ? '☀️ Temporada Alta' : '🌙 Temporada Baja'}</strong>
                    <span className="text-secondary" style={{ fontSize: '0.82rem' }}>
                      {manualHighSeason ? getHighSeasonText(seasonConfig) : getLowSeasonText(seasonConfig)}
                    </span>
                  </div>
                </label>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {isHighSeason ? <Sun size={20} color="#e67e22"/> : <Moon size={20} color="#3498db"/>}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>{isHighSeason ? '☀️ Temporada Alta' : '🌙 Temporada Baja'}</strong>
                    <span className="text-secondary" style={{ fontSize: '0.82rem' }}>
                      {isHighSeason ? getHighSeasonText(seasonConfig) : getLowSeasonText(seasonConfig)} (calculado según Check-in)
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="card glass-panel" style={{ marginBottom: '1.5rem' }}>
            <h2><Users size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }}/> Húespedes</h2>
            
            <div className="counter-list" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="counter-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                <div>
                  <strong>Adultos</strong>
                  <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Mayores de 15 años</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button className="btn-icon" onClick={() => setAdults(Math.max(1, adults - 1))}>-</button>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{adults}</span>
                  <button className="btn-icon" onClick={() => setAdults(adults + 1)}>+</button>
                </div>
              </div>

              <div className="counter-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                <div>
                  <strong>Niños</strong>
                  <div className="text-secondary" style={{ fontSize: '0.85rem' }}>7 a 15 años (Tarifa reducida)</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button className="btn-icon" onClick={() => setChildren(Math.max(0, children - 1))}>-</button>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{children}</span>
                  <button className="btn-icon" onClick={() => setChildren(children + 1)}>+</button>
                </div>
              </div>

              <div className="counter-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Bebés</strong>
                  <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Menores de 7 años (Gratis)</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button className="btn-icon" onClick={() => setBabies(Math.max(0, babies - 1))}>-</button>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{babies}</span>
                  <button className="btn-icon" onClick={() => setBabies(babies + 1)}>+</button>
                </div>
              </div>
            </div>
          </div>

          <div className="card glass-panel">
            <h2>Servicios Extra</h2>
            
            <div style={{ marginTop: '1rem' }}>
              <div className="form-group checkbox-group" style={{ background: includeCar ? 'rgba(var(--primary-color-rgb), 0.1)' : 'transparent', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={includeCar} 
                    onChange={(e) => setIncludeCar(e.target.checked)}
                  />
                  <Car size={20} color="var(--primary-color)"/>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>Arriendo de Vehículo</strong>
                    <span className="text-secondary" style={{ fontSize: '0.85rem' }}>{formatCurrency(carPricePerDay)} por día</span>
                  </div>
                </label>

                {includeCar && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', paddingLeft: '2rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Cantidad de días:</span>
                    <input 
                      type="number" 
                      min="1" 
                      value={carDays} 
                      onChange={(e) => setCarDays(Math.max(1, parseInt(e.target.value) || 1))}
                      className="form-input"
                      style={{ width: '80px', padding: '0.5rem' }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Right Panel: PDF Preview */}
        <div className="right-panel">
          <div style={{ width: '100%', minWidth: isExporting ? '800px' : 'auto', transition: 'min-width 0.1s' }}>
            <div className="card glass-panel invoice-preview-container" style={{ background: '#FAF7F2' }} ref={invoiceRef}>
              <div className="invoice-header">
                <h2 className="invoice-title">CABAÑAS MANUARA</h2>
              <div className="invoice-subtitle">CÓDIGO SERNATUR: 34494</div>
              <h3 className="invoice-doc-type">PRESUPUESTO DE ESTADÍA</h3>
            </div>

            <div className="invoice-body">
              <div className="invoice-section">
                <div className="invoice-detail-row">
                  <strong>Titular:</strong> <span>{titular || '—'}</span>
                </div>
                <div className="invoice-detail-row">
                  <strong>Check-in:</strong> <span>{format(startDate, "dd MMM yyyy", { locale: es })}</span>
                </div>
                <div className="invoice-detail-row">
                  <strong>Check-out:</strong> <span>{format(endDate, "dd MMM yyyy", { locale: es })}</span>
                </div>
                <div className="invoice-detail-row">
                  <strong>Duración:</strong> <span>{nights} {nights === 1 ? 'noche' : 'noches'}</span>
                </div>
                <div className="invoice-detail-row">
                  <strong>Húespedes:</strong> <span>{totalGuests} total</span>
                </div>
              </div>

              <div className="invoice-section">
                <div className="invoice-section-title">DESGLOSE</div>
                
                {adults > 0 && (
                  <div className="invoice-detail-row">
                    <span>{adults}x Adultos ({formatCurrency(priceAdult)}/noche):</span>
                    <span>{formatCurrency(totalAdults)}</span>
                  </div>
                )}
                
                {children > 0 && (
                  <div className="invoice-detail-row">
                    <span>{children}x Niños ({formatCurrency(priceChild)}/noche):</span>
                    <span>{formatCurrency(totalChildren)}</span>
                  </div>
                )}

                {babies > 0 && (
                  <div className="invoice-detail-row">
                    <span>{babies}x Bebés (Gratis):</span>
                    <span>$0</span>
                  </div>
                )}

                {includeCar && (
                  <div style={{ marginTop: '1rem' }}>
                    <div className="invoice-section-title">EXTRAS</div>
                    <div className="invoice-detail-row">
                      <span>Arriendo Vehículo ({carDays} {carDays === 1 ? 'día' : 'días'}):</span>
                      <span>{formatCurrency(totalCar)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '20px', marginBottom: '20px', padding: '15px', backgroundColor: '#fffef9', borderLeft: '4px solid #d4a373', fontSize: '0.85rem', color: '#6b4c2a' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Detalles del Servicio:</div>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>Incluye servicio de traslado desde y hacia el aeropuerto.</li>
                  <li>Incluye bienvenida con collar de flores.</li>
                  <li>No incluye servicio de desayuno.</li>
                </ul>
              </div>

              <div className="invoice-detail-row" style={{ fontSize: '1.4rem', fontWeight: 'bold', borderTop: '2px solid #333', marginTop: '1rem', paddingTop: '1rem' }}>
                <span>Total Estimado:</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
              
              <div style={{ marginTop: '15px', textAlign: 'center', fontSize: '0.8rem', color: '#666', fontStyle: 'italic' }}>
                ESTE PRESUPUESTO TIENE UNA VALIDEZ DE 7 DÍAS, POSTERIOR A ESTO SE DEBERÁ GENERAR OTRO PRESUPUESTO.
              </div>
            </div>
          </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleExportPDF} disabled={isExporting}>
              <Download size={20} /> Exportar PDF
            </button>
            <button 
              className="btn btn-primary" 
              style={{ flex: 1, backgroundColor: '#25D366', borderColor: '#25D366', color: 'white', opacity: isUploading ? 0.7 : 1 }} 
              onClick={handleWhatsAppQuote}
              disabled={isUploading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              {isUploading ? 'Procesando y Subiendo...' : 'Enviar Cotización'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
