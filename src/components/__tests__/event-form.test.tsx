import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithStore } from '@/test-utils';

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
    await renderWithStore(<EventForm submitLabel="Crear evento" onSubmit={onSubmit} />);
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
      contactId: null, // cargado a mano: no viene de ningún contacto
      phone: null,
      reminders: [{ amount: 1, unit: 'dias' }],
      yearly: 0,
      isMine: 0,
    });
  });

  it('al elegir tipo Cumpleaños activa la repetición anual por defecto', async () => {
    const onSubmit = await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Mamá');
    await fireEvent.press(screen.getByText('Cumpleaños'));
    await fireEvent.press(screen.getByText('Crear evento'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'cumpleanos', yearly: 1 }));
  });

  it('permite acumular varios avisos, del más lejano al más cercano', async () => {
    const onSubmit = await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Mamá');
    // '1 día antes' ya viene por defecto; sumamos '1 mes antes' y '1 hora antes'.
    await fireEvent.press(screen.getByText('1 mes antes'));
    await fireEvent.press(screen.getByText('1 hora antes'));
    await fireEvent.press(screen.getByText('Crear evento'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        reminders: [
          { amount: 1, unit: 'meses' },
          { amount: 1, unit: 'dias' },
          { amount: 1, unit: 'horas' },
        ],
      }),
    );
  });

  it('en un cumpleaños, escribir la edad fija el año de nacimiento', async () => {
    const onSubmit = await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Ana');
    await fireEvent.press(screen.getByText('Cumpleaños'));
    await fireEvent.changeText(screen.getByLabelText('Edad que cumple este año'), '30');
    await fireEvent.press(screen.getByText('Crear evento'));

    const añoNacimiento = new Date().getFullYear() - 30;
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ date: expect.stringContaining(String(añoNacimiento)) }),
    );
  });

  it('mi cumpleaños se marca desde el perfil, no en el formulario', async () => {
    await renderForm();

    await fireEvent.press(screen.getByText('Cumpleaños'));

    expect(screen.queryByLabelText('Este es mi cumpleaños')).toBeNull();
  });

  it('permite quitar todos los recordatorios', async () => {
    const onSubmit = await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Turno médico');
    await fireEvent.press(screen.getByLabelText('Quitar aviso 1 día antes'));
    await fireEvent.press(screen.getByText('Crear evento'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ reminders: [] }));
  });
});
