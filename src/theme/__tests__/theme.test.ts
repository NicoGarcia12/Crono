import { resolveTheme, THEMES } from '@/theme/theme';

describe('resolveTheme', () => {
  it('con preferencia explícita, ignora lo que diga el sistema', () => {
    expect(resolveTheme('claro', 'dark')).toBe('claro');
    expect(resolveTheme('oscuro', 'light')).toBe('oscuro');
  });

  it('en automático sigue al tema del celular', () => {
    expect(resolveTheme('sistema', 'dark')).toBe('oscuro');
    expect(resolveTheme('sistema', 'light')).toBe('claro');
  });

  it('si el sistema no informa nada, usa el tema claro', () => {
    expect(resolveTheme('sistema', null)).toBe('claro');
    expect(resolveTheme('sistema', undefined)).toBe('claro');
  });
});

describe('paletas', () => {
  it('los dos temas definen exactamente los mismos colores', () => {
    expect(Object.keys(THEMES.claro).sort()).toEqual(Object.keys(THEMES.oscuro).sort());
  });

  it('el tema oscuro tiene fondo oscuro y texto claro (y el claro al revés)', () => {
    // Regla simple para no invertir un color por accidente: comparamos el brillo.
    const brillo = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);

    expect(brillo(THEMES.oscuro.background)).toBeLessThan(brillo(THEMES.oscuro.text));
    expect(brillo(THEMES.claro.background)).toBeGreaterThan(brillo(THEMES.claro.text));
  });
});
