/**
 * Formatea un monto entero en Pesos Chilenos (CLP).
 */
export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Normaliza un número de WhatsApp dejando solo dígitos (y anteponiendo 56 si son 9 dígitos chilenos).
 */
export function normalizeWhatsApp(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('9')) {
    return `56${digits}`;
  }
  return digits;
}

/**
 * Valida formato de WhatsApp (entre 8 y 15 dígitos).
 */
export function isValidWhatsApp(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Indica si la ubicación del usuario está en modo privado / sin torre.
 */
export function isPrivateUnit(unitNumber: string | null | undefined): boolean {
  if (!unitNumber) return true;
  const normalized = unitNumber.trim().toLowerCase();
  return (
    normalized === '' ||
    normalized === 'privado' ||
    normalized === 'condominio' ||
    normalized === 'no especificado'
  );
}

/**
 * Genera el enlace seguro wa.me con mensaje formal y amable SIN exponer Torre ni Depto.
 */
export function buildWhatsAppUrl(
  rawPhone: string,
  productTitle: string,
  priceClp: number,
  sellerName: string,
  buyerName: string
): string {
  const phone = normalizeWhatsApp(rawPhone);
  const message = `Hola ${sellerName}, buenas. Soy ${buyerName} (vecino del condominio) y me interesa tu anuncio: "${productTitle}" (${formatCLP(priceClp)}). ¿Sigue disponible? Muchas gracias.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Formatea una fecha ISO en formato chileno legible (ej: 27/11/2026, 12:38).
 */
export function formatDateTimeCL(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Genera el enlace wa.me para que un vecino recién registrado avise al Administrador y pida autorización.
 */
export function buildAdminApprovalWhatsAppUrl(
  adminPhone: string,
  residentName: string,
  residentUnit: string,
  residentWhatsapp: string,
  termsAcceptedAt?: string | null
): string {
  const phone = normalizeWhatsApp(adminPhone);
  const consentLine = termsAcceptedAt
    ? `\n• Consentimiento y Normas: Aceptado el ${formatDateTimeCL(termsAcceptedAt)}`
    : '\n• Consentimiento y Normas: Aceptado al registrarse';
  const message = `Hola Administrador, buenas. Me acabo de registrar en el Mercado del Condominio y solicito autorización para ingresar.\n\n• Nombre: ${residentName}\n• Ubicación: ${residentUnit}\n• Mi WhatsApp: ${residentWhatsapp}${consentLine}\n\nMuchas gracias.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Genera el enlace wa.me para pedir ayuda o soporte a un contacto de administración.
 */
export function buildSupportWhatsAppUrl(
  supportPhone: string,
  supportLabel: string,
  residentName: string,
  residentUnit: string
): string {
  const phone = normalizeWhatsApp(supportPhone);
  const message = `Hola ${supportLabel}, buenas. Soy ${residentName} de ${residentUnit} y necesito ayuda con el Mercado del Condominio. Muchas gracias.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Genera enlace wa.me para reportar un anuncio inapropiado o ilegal a la administración.
 */
export function buildReportProductWhatsAppUrl(
  supportPhone: string,
  productTitle: string,
  sellerName: string,
  sellerUnit: string,
  reporterName: string,
  reporterUnit: string
): string {
  const phone = normalizeWhatsApp(supportPhone);
  const message = `Hola Administración, soy ${reporterName} (${reporterUnit}). Quisiera reportar el anuncio "${productTitle}" publicado por ${sellerName} (${sellerUnit}) porque podría incumplir las normas del condominio.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Valida que una URL de imagen sea HTTPS segura (previene javascript: o data: maliciosos).
 */
export function isSafeImageUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extrae torre (1-11), piso (1-7) y depto (1-4) de un texto como "Torre 8 - Depto 403".
 */
export function parseUnitNumber(unitNumber: string): {
  tower: number;
  floor: number;
  apt: number;
} {
  const match = unitNumber.match(/Torre\s*(\d+)\s*-\s*Depto\s*(\d)0(\d)/i);
  if (match) {
    const tower = Math.min(11, Math.max(1, Number(match[1])));
    const floor = Math.min(7, Math.max(1, Number(match[2])));
    const apt = Math.min(4, Math.max(1, Number(match[3])));
    return { tower, floor, apt };
  }
  return { tower: 1, floor: 1, apt: 1 };
}
