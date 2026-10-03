import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithStore } from '@/test-utils';

import { EventForm } from '@/components/event-form';
import type { CustomField, EventItem, EventTypeMeta } from '@/types';
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
  const miCumple: EventItem = {
    id: 8,
    title: 'Mi cumpleaños',
    type: 'cumpleanos',
    date: '1990-08-08',
    time: null,
    description: null,
    contactId: null,
    phone: null,
    reminders: [],
    yearly: 1,
    isMine: 1,
    tags: [],
    photoUri: null,
    yearUnknown: 0,
  };

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

    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
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
      tags: [],
      photoUri: null,
      yearUnknown: 0,
    });
  });

  it('al elegir tipo Cumpleaños activa la repetición anual por defecto', async () => {
    const onSubmit = await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Mamá');
    await fireEvent.press(screen.getByText('Cumpleaños'));
    await fireEvent.press(screen.getByText('Crear evento'));

    expect(onSubmit.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ type: 'cumpleanos', yearly: 1 }));
  });

  it('permite acumular varios avisos, del más lejano al más cercano', async () => {
    const onSubmit = await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Mamá');
    // '1 día antes' ya viene por defecto; sumamos '1 mes antes' y '1 hora antes'.
    await fireEvent.press(screen.getByText('1 mes antes'));
    await fireEvent.press(screen.getByText('1 hora antes'));
    await fireEvent.press(screen.getByText('Crear evento'));

    expect(onSubmit.mock.calls[0]?.[0]).toEqual(
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
    expect(onSubmit.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ date: expect.stringContaining(String(añoNacimiento)) }),
    );
  });

  it('mi cumpleaños se marca desde el perfil, no en el formulario', async () => {
    await renderForm();

    await fireEvent.press(screen.getByText('Cumpleaños'));

    expect(screen.queryByLabelText('Este es mi cumpleaños')).toBeNull();
  });

  it('conserva el tipo cumpleaños al editar mi cumpleaños', async () => {
    const onSubmit = jest.fn();
    await renderWithStore(<EventForm initial={miCumple} submitLabel="Guardar" onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByText('Evento'));
    await fireEvent.press(screen.getByText('Guardar'));

    expect(onSubmit.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ type: 'cumpleanos' }));
  });

  it('conserva la repetición anual al editar mi cumpleaños', async () => {
    const onSubmit = jest.fn();
    await renderWithStore(<EventForm initial={miCumple} submitLabel="Guardar" onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByText('Guardar'));

    expect(onSubmit.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ yearly: 1 }));
  });

  it('la repetición la decide el tipo: se informa, no hay switch para cambiarla', async () => {
    await renderForm();
    expect(screen.getByText('Es por única vez')).toBeTruthy();

    await fireEvent.press(screen.getByText('Día festivo'));
    expect(screen.getByText('Se repite todos los años')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('una cita médica no se puede guardar sin hora', async () => {
    const onSubmit = await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Dentista');
    await fireEvent.press(screen.getByText('Cita médica'));
    await fireEvent.press(screen.getByText('Crear evento'));

    expect(screen.getByText('Hora')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('en un cumpleaños se puede marcar que no se sabe el año: oculta la edad', async () => {
    const onSubmit = await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Ana');
    await fireEvent.press(screen.getByText('Cumpleaños'));
    await fireEvent(screen.getByLabelText('No sé el año de nacimiento'), 'valueChange', true);

    expect(screen.queryByLabelText('Edad que cumple este año')).toBeNull();
    await fireEvent.press(screen.getByText('Crear evento'));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ yearUnknown: 1 }));
  });

  it('el aniversario es una conmemoración: sin teléfono ni edad', async () => {
    await renderForm();

    await fireEvent.press(screen.getByText('Aniversario'));

    expect(screen.queryByLabelText('Teléfono')).toBeNull();
    expect(screen.queryByLabelText('Edad que cumple este año')).toBeNull();
  });

  it('un evento viejo conserva su repetición mientras no le cambien el tipo', async () => {
    const onSubmit = jest.fn();
    const viejo: EventItem = { ...miCumple, id: 9, title: 'Aniversario de casados', type: 'evento', isMine: 0 };
    await renderWithStore(<EventForm initial={viejo} submitLabel="Guardar" onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByText('Guardar'));

    expect(onSubmit.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ type: 'evento', yearly: 1 }));
  });

  it('permite quitar todos los recordatorios', async () => {
    const onSubmit = await renderForm();

    await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Turno médico');
    await fireEvent.press(screen.getByLabelText('Quitar aviso 1 día antes'));
    await fireEvent.press(screen.getByText('Crear evento'));

    expect(onSubmit.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ reminders: [] }));
  });

  describe('campos personalizados', () => {
    // Base 5 = Cita médica (orden de DEFAULT_EVENT_BASES). Tipo propio 20 = "Torneo".
    const torneo: EventTypeMeta = {
      id: 20, key: 'torneo', label: 'Torneo', icon: 'star', color: '#000',
      defaultYearly: false, isBuiltin: false, baseKey: 'evento', extraCapabilities: [],
    };
    const fields: CustomField[] = [
      { id: 1, owner: 'type', ownerId: 20, label: 'Qué llevar', kind: 'multi', options: ['Pelota', 'Agua'], position: 0 },
      { id: 2, owner: 'base', ownerId: 5, label: 'Obra social', kind: 'texto', options: [], position: 0 },
      { id: 3, owner: 'type', ownerId: 20, label: 'Cancha', kind: 'numero', options: [], position: 1 },
    ];

    const renderWithFields = async (initial?: EventItem, fieldValues = {}) => {
      const onSubmit = jest.fn();
      await renderWithStore(
        <EventForm initial={initial} submitLabel="Guardar" onSubmit={onSubmit} />,
        { fields, types: [torneo], fieldValues },
      );
      return onSubmit;
    };

    it('los extras del tipo son opcionales y viajan con sus valores', async () => {
      const onSubmit = await renderWithFields();

      await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Final');
      await fireEvent.press(screen.getByText('Torneo'));
      expect(screen.getByText('Qué llevar (opcional)')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Qué llevar: Agua'));
      await fireEvent.press(screen.getByLabelText('Qué llevar: Pelota'));
      await fireEvent.press(screen.getByText('Guardar'));

      expect(onSubmit.mock.calls[0]?.[1]).toEqual({ 1: '["Agua","Pelota"]' });
    });

    it('un campo obligatorio de la base no deja guardar vacío', async () => {
      const onSubmit = await renderWithFields();

      await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Dentista');
      await fireEvent.press(screen.getByText('Cita médica'));
      await fireEvent.press(screen.getByText('Guardar'));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText('Completá "Obra social".')).toBeTruthy();
    });

    it('un campo numérico rechaza texto', async () => {
      const onSubmit = await renderWithFields();

      await fireEvent.changeText(screen.getByPlaceholderText('Ej: Cumpleaños de mamá'), 'Final');
      await fireEvent.press(screen.getByText('Torneo'));
      await fireEvent.changeText(screen.getByLabelText('Cancha'), 'la del club');
      await fireEvent.press(screen.getByText('Guardar'));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText('"Cancha" tiene que ser un número.')).toBeTruthy();
    });

    it('al editar, arranca con los valores guardados', async () => {
      const final: EventItem = { ...miCumple, id: 30, title: 'Final', type: 'torneo', isMine: 0, yearly: 0 };
      const onSubmit = await renderWithFields(final, { 30: { 3: '4' } });

      expect(screen.getByDisplayValue('4')).toBeTruthy();
      await fireEvent.press(screen.getByText('Guardar'));
      expect(onSubmit.mock.calls[0]?.[1]).toEqual({ 3: '4' });
    });
  });
});
