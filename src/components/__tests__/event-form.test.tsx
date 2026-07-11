import { fireEvent, render, screen } from '@testing-library/react-native';

import { EventForm } from '@/components/event-form';
import { todayIso } from '@/utils/dates';

/**
 * 💡 Aprendizaje: RNTL renderiza el componente en Node (sin celular) y permite
 * interactuar como un usuario: escribir, tocar, leer lo visible. Desde RNTL 14
 * `render` y `fireEvent` son async (React 19 renderiza de forma concurrente),
 * por eso todos llevan await. El picker nativo de fecha se mockea porque Jest
 * no puede ejecutar módulos nativos.
 */

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

describe('<EventForm />', () => {
  const renderForm = async () => {
    const onSubmit = jest.fn();
    await render(<EventForm submitLabel="Crear evento" onSubmit={onSubmit} />);
    return onSubmit;
  };

  it('no permite guardar sin título', async () => {
    const onSubmit = await renderForm();

    await fireEvent.press(screen.getByText('Crear evento'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('guarda con los valores por defecto: tipo evento, hoy, aviso 1 día antes', async () => {
    const onSubmit = await renderForm();

    await fireEvent.changeText(
      screen.getByPlaceholderText('Ej: Cumpleaños de mamá'),
      '  Cena con amigos  ',
    );
    await fireEvent.press(screen.getByText('Crear evento'));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Cena con amigos', // el título se guarda sin espacios sobrantes
      type: 'evento',
      date: todayIso(),
      time: null,
      description: null,
      reminderMinutes: [60 * 24],
      yearly: 0,
    });
  });

  it('al elegir tipo Cumpleaños activa la repetición anual por defecto', async () => {
    const onSubmit = await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Mamá');
    await fireEvent.press(screen.getByText('Cumpleaños'));
    await fireEvent.press(screen.getByText('Crear evento'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'cumpleanos', yearly: 1 }));
  });

  it('permite elegir VARIOS recordatorios a la vez', async () => {
    const onSubmit = await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Mamá');
    // '1 día antes' ya viene elegido por defecto; sumamos '1 semana antes'.
    await fireEvent.press(screen.getByText('1 semana antes'));
    await fireEvent.press(screen.getByText('Crear evento'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ reminderMinutes: [60 * 24, 60 * 24 * 7] }),
    );
  });

  it('permite quitar todos los recordatorios', async () => {
    const onSubmit = await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Turno médico');
    await fireEvent.press(screen.getByText('Sin recordatorio'));
    await fireEvent.press(screen.getByText('Crear evento'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ reminderMinutes: [] }));
  });
});
