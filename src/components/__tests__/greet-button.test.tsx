import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { GreetButton } from '@/components/greet-button';
import type { EventItem } from '@/types';

const evento = (over: Partial<EventItem>): EventItem => ({
  id: 1,
  title: 'Ana Perez',
  type: 'cumpleanos',
  date: '1995-12-20',
  time: null,
  description: null,
  contactId: 'c1',
  phone: '+54 9 11 5555-0001',
  reminders: [],
  yearly: 1,
  ...over,
});

describe('<GreetButton />', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('abre WhatsApp con el saludo ya escrito', async () => {
    await render(<GreetButton event={evento({})} />);

    await fireEvent.press(screen.getByLabelText('Saludar por WhatsApp'));

    expect(Linking.openURL).toHaveBeenCalledWith(
      `https://wa.me/5491155550001?text=${encodeURIComponent('¡Feliz cumple, Ana! 🎉')}`,
    );
  });

  it('no se muestra si el cumpleaños no tiene teléfono', async () => {
    await render(<GreetButton event={evento({ phone: null })} />);

    expect(screen.queryByLabelText('Saludar por WhatsApp')).toBeNull();
  });

  it('no se muestra en tipos donde no corresponde saludar', async () => {
    await render(<GreetButton event={evento({ type: 'cita_medica' })} />);

    expect(screen.queryByLabelText('Saludar por WhatsApp')).toBeNull();
  });
});
