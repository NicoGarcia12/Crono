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
    expect(greetingMessage({ title: 'Ana Perez', type: 'cumpleanos' })).toBe('¡Feliz cumple, Ana! 🎉');
  });

  it('usa un saludo distinto en un aniversario', () => {
    expect(greetingMessage({ title: 'Ana', type: 'aniversario' })).toBe('¡Feliz aniversario! 🎊');
  });
});

describe('whatsappUrl', () => {
  it('arma el link de wa.me con el saludo codificado', () => {
    const url = whatsappUrl({ title: 'Ana', type: 'cumpleanos', phone: '+54 9 11 5555-0001' });

    expect(url).toBe(`https://wa.me/5491155550001?text=${encodeURIComponent('¡Feliz cumple, Ana! 🎉')}`);
  });

  it('devuelve null si el evento no tiene teléfono', () => {
    expect(whatsappUrl({ title: 'Ana', type: 'cumpleanos', phone: null })).toBeNull();
  });
});

describe('canGreet', () => {
  it('habilita el saludo solo en cumpleaños y aniversarios con teléfono', () => {
    expect(canGreet({ type: 'cumpleanos', phone: '+5491155550001' })).toBe(true);
    expect(canGreet({ type: 'aniversario', phone: '+5491155550001' })).toBe(true);
    expect(canGreet({ type: 'cita_medica', phone: '+5491155550001' })).toBe(false);
    expect(canGreet({ type: 'cumpleanos', phone: null })).toBe(false);
  });
});
