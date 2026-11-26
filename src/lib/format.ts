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
 * Genera el enlace seguro wa.me con mensaje formal y amable indicando Torre y Depto del comprador.
 */
export function buildWhatsAppUrl(
  rawPhone: string,
  productTitle: string,
  priceClp: number,
  sellerName: string,
  buyerName: string,
  buyerUnit: string
): string {
  const phone = normalizeWhatsApp(rawPhone);
  const message = `Hola ${sellerName}, buenas. Soy ${buyerName} de ${buyerUnit} (del condominio) y me interesa tu anuncio: "${productTitle}" (${formatCLP(priceClp)}). ¿Sigue disponible? Muchas gracias.`;
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
