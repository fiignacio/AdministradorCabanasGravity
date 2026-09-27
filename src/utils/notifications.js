// Utilidad de Notificaciones Nativas en Móviles/Navegadores con Sonido y Vibración para Cabañas Manuara

// 1. Reproducir sonido de notificación sintetizado mediante Web Audio API
export const playNotificationSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // Desbloquear contexto si está suspendido
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const now = ctx.currentTime;
    
    // Tono 1: Mi5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tono 2: Si5 (987.77 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.15);
    gain2.gain.setValueAtTime(0.4, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.warn('El reproductor de sonido de notificación no está disponible:', e);
  }
};

// 2. Ejecutar vibración en dispositivos móviles nativos
export const triggerVibration = (pattern = [300, 100, 300]) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('La vibración del dispositivo no pudo ejecutarse:', e);
    }
  }
};

// 3. Solicitar permisos para Notificaciones Nativas del sistema operativo/móvil
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    alert('Este dispositivo/navegador no soporta notificaciones push nativas.');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

// 4. Emitir Notificación Nativa completa (Sonido + Vibración + Banner del Sistema)
export const sendNativeNotification = (title, body, options = {}) => {
  // Siempre hace sonar y vibrar en dispositivos móviles
  playNotificationSound();
  triggerVibration([300, 100, 300]);

  // Si tiene permisos, lanza la banner nativa del sistema operativo
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body,
        icon: '/images/logo_manuara.png',
        badge: '/images/logo_manuara.png',
        vibrate: [300, 100, 300],
        tag: 'cabin-manuara-alert',
        renotify: true,
        ...options
      });
      
      notif.onclick = () => {
        window.focus();
        if (options.url) {
          window.location.href = options.url;
        }
      };
    } catch (e) {
      console.warn('Error al desplegar notificación nativa:', e);
    }
  }
};
