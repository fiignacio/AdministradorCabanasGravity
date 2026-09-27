export const formatWhatsAppNumber = (phone) => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  // If it's a Chilean number without country code (9 digits starting with 9)
  if (cleaned.length === 9 && cleaned.startsWith('9')) {
    return `56${cleaned}`;
  }
  // If user typed 569...
  if (cleaned.startsWith('56') && cleaned.length >= 11) {
    return cleaned;
  }
  // Default fallback
  return cleaned;
};

export const generateWhatsAppLink = (phone, message) => {
  const formattedPhone = formatWhatsAppNumber(phone);
  if (!formattedPhone) return '';
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
};

export const generateCarMessage = (res, carName, template = 'confirmation', businessName = 'nuestra administración') => {
  const deposit = res.depositAmount || 0;
  const total = res.totalCost || 0;
  const balance = total - deposit;
  const client = res.clientName || 'Estimado/a';

  if (template === 'checkin') {
    return `¡Hola *${client}*! 👋\nTe escribimos de ${businessName} para recordar que la fecha de entrega de tu vehículo (*${carName}*) está programada para hoy o mañana (*${res.startDate}*).\n\n🚗 *Vehículo:* ${carName}\nPor favor confírmanos tu hora aproximada de llegada para coordinar el retiro.\n¡Te esperamos!`;
  }

  if (template === 'checkout') {
    return `¡Hola *${client}*! 👋\nTe escribimos de ${businessName} para recordarte que la fecha de devolución del vehículo (*${carName}*) es el *${res.endDate}*.\n\nPor favor avísanos si necesitas extensión o coordinar el punto de entrega. ¡Muchas gracias!`;
  }

  if (template === 'payment') {
    return `¡Hola *${client}*! 👋\nTe escribimos de ${businessName} para recordarte que tienes un saldo pendiente por el arriendo del vehículo *${carName}*.\n\n💰 *Saldo a pagar:* $${balance.toLocaleString('es-CL')}\n\nQuedamos atentos al comprobante de transferencia. ¡Saludos!`;
  }

  // Default: confirmation
  let msg = `¡Hola *${client}*! 👋\nTe escribimos de ${businessName} para confirmar tu arriendo del vehículo *${carName}*.\n\n`;
  msg += `📅 *Fechas:* Retiro el ${res.startDate} - Devolución el ${res.endDate}\n`;
  msg += `💰 *Total:* $${total.toLocaleString('es-CL')}\n`;
  if (deposit > 0) {
    msg += `✅ *Abono registrado:* $${deposit.toLocaleString('es-CL')}\n`;
    if (balance > 0) {
      msg += `⏳ *Saldo pendiente:* $${balance.toLocaleString('es-CL')}\n`;
    }
  }
  msg += `\n¡Gracias por preferirnos!`;
  return msg;
};

export const generateTourMessage = (res, tourName, template = 'confirmation', businessName = 'nuestra administración') => {
  const total = res.totalCost || 0;
  const client = res.clientName || 'Estimado/a';

  if (template === 'reminder') {
    return `¡Hola *${client}*! 👋\nTe recordamos de ${businessName} que tu tour *${tourName}* (${res.paxCount || 1} Pax) está agendado para el *${res.date}* a las *${res.time || '09:00'}*.\n\n📍 *Recomendaciones:* Llegar 10 minutos antes, traer calzado cómodo, bloqueador solar y agua.\n\n¿Nos confirmas tu asistencia? ¡Nos vemos pronto! 🧭`;
  }

  if (template === 'payment') {
    return `¡Hola *${client}*! 👋\nTe escribimos de ${businessName} para recordarte que tienes un saldo pendiente por la reserva del tour *${tourName}*.\n\n💰 *Total:* $${total.toLocaleString('es-CL')}\n\nQuedamos atentos a tu confirmación. ¡Muchas gracias!`;
  }

  // Default: confirmation
  let msg = `¡Hola *${client}*! 👋\nTe escribimos de ${businessName} para enviar los detalles de tu reserva de tour.\n\n`;
  msg += `🧭 *Tour:* ${tourName}\n`;
  msg += `📅 *Fecha:* ${res.date} a las ${res.time || '09:00'}\n`;
  msg += `👥 *Pasajeros:* ${res.paxCount || 1} Pax\n`;
  msg += `💰 *Total:* $${total.toLocaleString('es-CL')}\n\n`;
  msg += `¡Quedamos muy atentos a tu salida!`;
  return msg;
};

export const generateQuoteMessage = (titular, pdfUrl = '', businessName = 'nuestra administración') => {
  let msg = `¡Hola ${titular ? '*' + titular + '*' : 'estimado/a'}! 👋\nTe envío la cotización formal de tu estadía en ${businessName}, incluyendo el desglose detallado de huéspedes y extras.\n\n`;
  if (pdfUrl) {
    msg += `📄 *Ver y descargar Cotización:* ${pdfUrl}\n\n`;
  }
  msg += `Revisa el documento y cualquier duda me avisas para poder agendar tu reserva. ¡Quedo atento/a!`;
  return msg;
};

export const generateInvitationMessage = (titular, pdfUrl = '', businessName = 'nuestra administración') => {
  let msg = `¡Hola ${titular ? '*' + titular + '*' : 'estimado/a'}! 👋\nTe envío la Carta de Invitación y el Registro de Pasajeros para tu estadía en ${businessName}.\n\n`;
  if (pdfUrl) {
    msg += `📄 *Ver y descargar Carta de Invitación:* ${pdfUrl}\n\n`;
  }
  msg += `Este documento es útil para agilizar tu llegada y certificar tu reserva. ¡Te esperamos!`;
  return msg;
};

export const generatePublicRequestMessage = ({
  clientName,
  clientPhone,
  cabinName,
  startDate,
  endDate,
  nights,
  adults,
  childrenCount,
  babiesCount,
  carName,
  carDays,
  grandTotal,
  deposit50,
  notes,
  businessName = 'Cabañas Manuara'
}) => {
  let msg = `*SOLICITUD DE RESERVA - ${businessName.toUpperCase()}*\n`;
  msg += `----------------------------------------\n`;
  msg += `🏡 *Alojamiento:* ${cabinName}\n`;
  msg += `📅 *Check-In:* ${startDate}\n`;
  msg += `📅 *Check-Out:* ${endDate} (${nights} ${nights === 1 ? 'noche' : 'noches'})\n`;
  msg += `👥 *Pasajeros:* ${adults} Adultos`;
  if (childrenCount > 0) msg += `, ${childrenCount} Niños`;
  if (babiesCount > 0) msg += `, ${babiesCount} Bebés`;
  msg += `\n`;
  if (carName) {
    msg += `🚗 *Vehículo Solicitado:* ${carName} (${carDays} ${carDays === 1 ? 'día' : 'días'})\n`;
  }
  msg += `💰 *Total Estimado:* $${grandTotal.toLocaleString('es-CL')}\n`;
  msg += `💳 *Abono 50% Sugerido:* $${deposit50.toLocaleString('es-CL')}\n`;
  msg += `----------------------------------------\n`;
  msg += `👤 *Cliente:* ${clientName || 'No especificado'}\n`;
  msg += `📞 *Teléfono:* ${clientPhone || 'No especificado'}\n`;
  if (notes) {
    msg += `📝 *Notas / Solicitudes:* ${notes}\n`;
  }
  msg += `----------------------------------------\n`;
  msg += `⚠️ *Estado:* Solicitud Pendiente de Confirmación por Administración`;
  return msg;
};
