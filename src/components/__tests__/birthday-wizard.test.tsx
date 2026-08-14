import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithStore } from '@/test-utils';

import { BirthdayWizard } from '@/components/birthday-wizard';
import type { ContactCandidate } from '@/contacts/birthday-import';
import { todayIso } from '@/utils/dates';

jest.mock('expo-contacts', () => ({}));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

const ana: ContactCandidate = {
  key: 'c1',
  name: 'Ana',
  phone: '+54 11 5555-0001',
  suggestedDate: '1995-12-20',
  suggestedHasYear: true,
  loaded: null,
};

const bruno: ContactCandidate = {
  key: 'c2',
  name: 'Bruno',
  phone: null,
  suggestedDate: null,
  suggestedHasYear: false,
  loaded: null,
};

describe('<BirthdayWizard />', () => {
  it('recorre los contactos elegidos de a uno', async () => {
    await renderWithStore(<BirthdayWizard candidates={[ana, bruno]} onFinish={jest.fn()} />);

    expect(screen.getByText('Contacto 1 de 2')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();

    await fireEvent.press(screen.getByText('Guardar y siguiente'));

    expect(screen.getByText('Contacto 2 de 2')).toBeTruthy();
    expect(screen.getByText('Bruno')).toBeTruthy();
    // En el último cambia el texto del botón.
    expect(screen.getByText('Guardar y terminar')).toBeTruthy();
  });

  it('guarda la fecha que traía el contacto y la de hoy para el que no tenía', async () => {
    const onFinish = jest.fn();
    await renderWithStore(<BirthdayWizard candidates={[ana, bruno]} onFinish={onFinish} />);

    await fireEvent.press(screen.getByText('Guardar y siguiente'));
    await fireEvent.press(screen.getByText('Guardar y terminar'));

    expect(onFinish).toHaveBeenCalledWith([
      { candidate: ana, date: '1995-12-20' }, // precargada de la agenda del celular
      { candidate: bruno, date: todayIso() }, // sin fecha previa: arranca en hoy
    ]);
  });

  it('los salteados no se guardan', async () => {
    const onFinish = jest.fn();
    await renderWithStore(<BirthdayWizard candidates={[ana, bruno]} onFinish={onFinish} />);

    await fireEvent.press(screen.getByLabelText('Saltear contacto'));
    await fireEvent.press(screen.getByText('Guardar y terminar'));

    expect(onFinish).toHaveBeenCalledWith([{ candidate: bruno, date: todayIso() }]);
  });

  it('avisa cuando el contacto no tiene cumpleaños guardado en el celular', async () => {
    await renderWithStore(<BirthdayWizard candidates={[bruno]} onFinish={jest.fn()} />);

    expect(screen.getByText('Este contacto no tiene cumpleaños guardado en el celular.')).toBeTruthy();
  });
});
