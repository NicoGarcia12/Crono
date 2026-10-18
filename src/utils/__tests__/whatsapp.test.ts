import { capabilitiesOf } from '@/test-utils';
import { canGreet, greetingMessage, normalizePhone, whatsappUrl } from '@/utils/whatsapp';

describe('normalizePhone', () => {
  it('limpia separadores cuando el número ya trae código de país', () => {
    expect(normalizePhone('+54 9 11 5555-0001')).toBe('5491155550001');
    expect(normalizePhone('+34 600 123 456')).toBe('34600123456');
  });

  it('agrega el código de país cuando el número es local', () => {
    expect(normalizePhone('11 5555-0001')).toBe('541155550001');
  });

  it('saca el 0 de larga distancia', () => {
    expect(normalizePhone('011 5555-0001')).toBe('541155550001');
  });

  it('saca el 15 de celular (formato viejo argentino)', () => {
    expect(normalizePhone('11 15 5555-0001')).toBe('541155550001');
  });

  it('no duplica el código de país si ya está sin el +', () => {
    expect(normalizePhone('5491155550001')).toBe('5491155550001');
  });

  it('devuelve null si no hay número o no tiene dígitos', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('sin teléfono')).toBeNull();
  });
});

describe('greetingMessage', () => {
  it('saluda con el nombre de pila en un cumpleaños', () => {
    expect(greetingMessage({ title: 'Ana Perez' }, capabilitiesOf('cumpleanos'))).toBe('¡Feliz cumple, Ana! 🎉');
  });

  it('en un tipo sin edad, saluda sin desear feliz cumple', () => {
    expect(greetingMessage({ title: 'Ana' }, ['whatsapp'])).toBe('¡Hola, Ana!');
  });
});

describe('whatsappUrl', () => {
  it('arma el link de wa.me con el saludo codificado', () => {
    const url = whatsappUrl({ title: 'Ana', phone: '+54 9 11 5555-0001' }, capabilitiesOf('cumpleanos'));

    expect(url).toBe(`https://wa.me/5491155550001?text=${encodeURIComponent('¡Feliz cumple, Ana! 🎉')}`);
  });

  it('devuelve null si el evento no tiene teléfono', () => {
    expect(whatsappUrl({ title: 'Ana', phone: null }, capabilitiesOf('cumpleanos'))).toBeNull();
  });
});

describe('canGreet', () => {
  it('habilita el saludo solo si el tipo tiene WhatsApp y hay número', () => {
    expect(canGreet({ phone: '+5491155550001' }, capabilitiesOf('cumpleanos'))).toBe(true);
    // El aniversario ahora es una conmemoración: no se saluda a nadie.
    expect(canGreet({ phone: '+5491155550001' }, capabilitiesOf('aniversario'))).toBe(false);
    expect(canGreet({ phone: '+5491155550001' }, capabilitiesOf('cita_medica'))).toBe(false);
    expect(canGreet({ phone: null }, capabilitiesOf('cumpleanos'))).toBe(false);
  });
});
