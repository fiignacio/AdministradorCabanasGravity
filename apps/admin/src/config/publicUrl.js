/**
 * Normaliza VITE_PUBLIC_SITE_URL asegurando protocolo http:// o https://
 * para evitar que enlaces externos sean interpretados como rutas relativas.
 */
export const getPublicSiteUrl = () => {
  const raw = (import.meta.env.VITE_PUBLIC_SITE_URL || '').trim();
  if (!raw) return 'http://localhost:5173';
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, '');
  }
  return `https://${raw.replace(/^\/+/, '').replace(/\/+$/, '')}`;
};
