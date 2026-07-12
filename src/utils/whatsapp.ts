import type { EventItem } from '@/types';

/**
 * Saludo por WhatsApp.
 *
 * 💡 Aprendizaje: no hace falta ninguna librería ni permiso especial. WhatsApp
 * expone un link universal (`https://wa.me/<numero>?text=<mensaje>`): al abrirlo
 * el sistema operativo se lo pasa a la app de WhatsApp si está instalada, y si
 * no, cae en la versión web. Lo único delicado es el formato del número: wa.me
 * exige SOLO dígitos, con código de país y sin el '+'.
 */

/** Código de país por defecto cuando el contacto guardó el número sin el '+'. */
const DEFAULT_COUNTRY_CODE = '54'; // Argentina

/**
 * Deja el teléfono como lo pide wa.me: solo dígitos, con código de país.
 * Devuelve null si no hay número o no quedan dígitos.
 *
 * Casos contemplados:
 *  - '+54 9 11 5555-0001' → ya trae país: se limpian los separadores.
 *  - '011 5555-0001'      → local: se saca el 0 inicial y se agrega el país.
 *  - '11 15 5555-0001'    → el '15' es un resabio local que WhatsApp no usa.
 */
export function normalizePhone(raw: string | null, countryCode = DEFAULT_COUNTRY_CODE): string | null {
  if (!raw) return null;

  const hasCountryCode = raw.trim().startsWith('+');
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return null;

  if (hasCountryCode) return digits;

  digits = digits.replace(/^0/, ''); // 0 de larga distancia

  // Si ya viene con el código de país (aunque sin el '+'), no lo tocamos:
  // este chequeo va ANTES de sacar el '15', si no se le comen dígitos del medio.
  if (digits.startsWith(countryCode) && digits.length >= 12) return digits;

  digits = digits.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2'); // 15 de celular (formato viejo argentino)

  return `${countryCode}${digits}`;
}

/** Mensaje sugerido según el tipo de evento (el usuario lo puede editar en WhatsApp antes de enviarlo). */
export function greetingMessage(event: Pick<EventItem, 'title' | 'type'>): string {
  const nombre = event.title.split(' ')[0]; // solo el nombre de pila

  if (event.type === 'cumpleanos') return `¡Feliz cumple, ${nombre}! 🎉`;
  if (event.type === 'aniversario') return `¡Feliz aniversario! 🎊`;
  return `¡Hola, ${nombre}!`;
}

/** Link universal de WhatsApp con el saludo ya escrito. Null si el evento no tiene teléfono. */
export function whatsappUrl(event: Pick<EventItem, 'title' | 'type' | 'phone'>): string | null {
  const phone = normalizePhone(event.phone);
  if (!phone) return null;

  return `https://wa.me/${phone}?text=${encodeURIComponent(greetingMessage(event))}`;
}

/** Tipos de evento donde tiene sentido saludar. */
export function canGreet(event: Pick<EventItem, 'type' | 'phone'>): boolean {
  const saludable = event.type === 'cumpleanos' || event.type === 'aniversario';
  return saludable && normalizePhone(event.phone) !== null;
}
