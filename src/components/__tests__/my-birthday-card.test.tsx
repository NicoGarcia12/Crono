import { fireEvent, screen } from '@testing-library/react-native';

import { MyBirthdayCard } from '@/components/my-birthday-card';
import { renderWithStore } from '@/test-utils';
import type { EventItem } from '@/types';
import { formatLongDate, todayIso } from '@/utils/dates';

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

const miCumple: EventItem = {
  id: 7,
  title: 'Cumpleaños de Nico',
  type: 'cumpleanos',
  date: '1996-08-10',
  time: null,
  description: null,
  contactId: null,
  phone: null,
  reminders: [],
  yearly: 1,
  isMine: 1,
  tags: [],
  photoUri: null,
};

describe('<MyBirthdayCard />', () => {
  it('invita a cargarlo cuando todavía no está', async () => {
    const onSave = jest.fn();
    await renderWithStore(
      <MyBirthdayCard event={undefined} onSave={onSave} onOpenGreetings={jest.fn()} />,
    );

    expect(screen.getByText('Cargalo para poder anotar quién te saluda cada año')).toBeTruthy();
    // Sin cumpleaños cargado no hay lista de saludos todavía.
    expect(screen.queryByLabelText('Ver quién me saludó')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Guardar mi cumpleaños'));

    expect(onSave).toHaveBeenCalledWith(todayIso());
  });

  it('cuando está cargado muestra la fecha, la edad y el acceso a los saludos', async () => {
    const onOpenGreetings = jest.fn();
    await renderWithStore(
      <MyBirthdayCard event={miCumple} onSave={jest.fn()} onOpenGreetings={onOpenGreetings} />,
    );

    const edad = new Date().getFullYear() - 1996;
    expect(
      screen.getByText(`${formatLongDate(miCumple.date)} · cumplís ${edad} este año`),
    ).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Ver quién me saludó'));
    expect(onOpenGreetings).toHaveBeenCalled();
  });

  it('deja editar la fecha después de cargada', async () => {
    const onSave = jest.fn();
    await renderWithStore(
      <MyBirthdayCard event={miCumple} onSave={onSave} onOpenGreetings={jest.fn()} />,
    );

    await fireEvent.press(screen.getByLabelText('Editar mi cumpleaños'));
    await fireEvent.press(screen.getByLabelText('Guardar mi cumpleaños'));

    // Sin tocar el picker, guarda la fecha que ya tenía.
    expect(onSave).toHaveBeenCalledWith('1996-08-10');
  });
});
