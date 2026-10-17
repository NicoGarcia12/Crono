import { fireEvent, screen } from '@testing-library/react-native';

import { EventTypeForm } from '@/components/event-type-form';
import { renderWithStore } from '@/test-utils';
import type { CustomField, EventItem, EventTypeMeta } from '@/types';

const props = {
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

const cumpleanos: EventTypeMeta = {
  id: 2,
  key: 'cumpleanos',
  label: 'Cumpleaños',
  icon: 'gift',
  color: '#E91E63',
  defaultYearly: true,
  isBuiltin: true,
  baseKey: 'cumpleanos',
  extraCapabilities: [],
};

const torneo: EventTypeMeta = {
  id: 20,
  key: 'torneo',
  label: 'Torneo',
  icon: 'star',
  color: '#000',
  defaultYearly: false,
  isBuiltin: false,
  baseKey: 'evento',
  extraCapabilities: [],
};

const cancha: CustomField = {
  id: 3, owner: 'type', ownerId: 20, label: 'Cancha', kind: 'texto', options: [], position: 0, required: false,
};

const partido = (id: number): EventItem => ({
  id,
  title: `Partido ${id}`,
  type: 'torneo',
  date: '2026-11-01',
  time: null,
  description: null,
  contactId: null,
  phone: null,
  reminders: [],
  yearly: 0,
  isMine: 0,
  tags: [],
  photoUri: null,
  yearUnknown: 0,
});

describe('<EventTypeForm />', () => {
  it('no permite guardar sin nombre', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.press(screen.getByText('Guardar'));

    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Ponele un nombre al tipo.')).toBeTruthy();
  });

  it('crea un tipo nuevo a partir de una base, con extras y campos', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.changeText(screen.getByLabelText('Nombre del tipo'), 'Cumple de oficina');
    await fireEvent.press(screen.getByLabelText('Ícono star'));
    await fireEvent.press(screen.getByLabelText('Color #4CAF50'));
    await fireEvent.press(screen.getByLabelText('Base Cumpleaños'));
    await fireEvent.press(screen.getByLabelText('Agregar campo'));
    await fireEvent.changeText(screen.getByLabelText('Nombre del campo 1'), 'Qué llevar');
    await fireEvent.press(screen.getByLabelText('Campo 1: Varias opciones'));
    await fireEvent.changeText(screen.getByLabelText('Opciones del campo 1'), 'Torta, Bebida');
    await fireEvent.press(screen.getByText('Guardar'));

    expect(props.onSubmit).toHaveBeenCalledWith({
      label: 'Cumple de oficina',
      icon: 'star',
      color: '#4CAF50',
      baseKey: 'cumpleanos',
      extraCapabilities: [],
      fields: [{ label: 'Qué llevar', kind: 'multi', options: ['Torta', 'Bebida'], required: false }],
    });
  });

  it('cada campo del tipo puede marcarse como obligatorio', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.changeText(screen.getByLabelText('Nombre del tipo'), 'Torneo');
    await fireEvent.press(screen.getByLabelText('Agregar campo'));
    await fireEvent.changeText(screen.getByLabelText('Nombre del campo 1'), 'Cancha');
    expect(screen.getByText('Opcional')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Campo 1 obligatorio'), 'valueChange', true);
    await fireEvent.press(screen.getByText('Guardar'));

    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ fields: [{ label: 'Cancha', kind: 'texto', options: [], required: true }] }),
    );
  });

  it('lo que trae la base viene bloqueado y se cuenta para el límite', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.press(screen.getByLabelText('Base Cumpleaños'));

    // edad, saludado, whatsapp, regalos = 4 de 15
    expect(screen.getByText('4 de 15')).toBeTruthy();
    // Se listan una por renglón como incluidas, y no aparecen como interruptor.
    expect(screen.getByText('Incluido siempre (viene de la base)')).toBeTruthy();
    expect(screen.getAllByText('Función incluida')).toHaveLength(4);
    expect(screen.queryByLabelText('Edad')).toBeNull();
    // Años transcurridos choca con la Edad de la base: no se ofrece y se explica.
    expect(screen.queryByLabelText('Años transcurridos')).toBeNull();
    expect(
      screen.getByText('Años transcurridos no va junto con Edad, que ya trae la base.'),
    ).toBeTruthy();
  });

  it('no ofrece lo que no tiene sentido con la base, y recomienda otra', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    // La base Evento no se repite: edad, años y "¿ya lo saludé?" no aparecen.
    expect(screen.queryByLabelText('Edad')).toBeNull();
    expect(screen.queryByLabelText('Años transcurridos')).toBeNull();
    expect(screen.queryByLabelText('¿Ya lo saludé?')).toBeNull();
    expect(
      screen.getByText(
        'Edad, Años transcurridos y ¿Ya lo saludé? necesitan una base que se repita todos los años: probá con Cumpleaños o Aniversario.',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('Saludo por WhatsApp')).toBeTruthy();
  });

  it('si una función choca con otra prendida, lo explica debajo de esa', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    // Festivo se repite y no trae nada: edad y años se ofrecen, pero no juntos.
    await fireEvent.press(screen.getByLabelText('Base Festivo'));
    await fireEvent(screen.getByLabelText('Edad'), 'valueChange', true);
    await fireEvent(screen.getByLabelText('Años transcurridos'), 'valueChange', true);

    expect(
      screen.getByText('No se puede tener edad y años transcurridos a la vez: los dos muestran años.'),
    ).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nombre del tipo'), 'Torneo');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ extraCapabilities: ['edad'] }));
  });

  it('un select sin opciones no se puede guardar', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.changeText(screen.getByLabelText('Nombre del tipo'), 'Torneo');
    await fireEvent.press(screen.getByLabelText('Agregar campo'));
    await fireEvent.changeText(screen.getByLabelText('Nombre del campo 1'), 'Categoría');
    await fireEvent.press(screen.getByLabelText('Campo 1: Una opción'));
    await fireEvent.press(screen.getByText('Guardar'));

    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('"Categoría" necesita al menos una opción.')).toBeTruthy();
  });

  it('un tipo de fábrica solo edita nombre, ícono y color', async () => {
    await renderWithStore(<EventTypeForm {...props} initial={cumpleanos} />);

    expect(screen.getByDisplayValue('Cumpleaños')).toBeTruthy();
    expect(screen.queryByLabelText('Agregar campo')).toBeNull();
    await fireEvent.press(screen.getByText('Guardar'));

    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Cumpleaños', icon: 'gift', color: '#E91E63', baseKey: 'cumpleanos' }),
    );
  });

  it('cancelar avisa sin guardar', async () => {
    await renderWithStore(<EventTypeForm {...props} />);

    await fireEvent.press(screen.getByText('Cancelar'));

    expect(props.onCancel).toHaveBeenCalled();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  describe('pasar un campo a obligatorio', () => {
    it('no deja si hay eventos que no lo tienen completado, y dice cuántos', async () => {
      await renderWithStore(<EventTypeForm {...props} initial={torneo} />, {
        types: [torneo],
        fields: [cancha],
        events: [partido(1), partido(2), partido(3)],
        fieldValues: { 1: { 3: 'Club Norte' } },
      });

      await fireEvent(screen.getByLabelText('Campo 1 obligatorio'), 'valueChange', true);

      expect(
        screen.getByText('2 eventos no lo tienen completado. Dejalo opcional, o completalo en esos eventos y después pasalo a obligatorio.'),
      ).toBeTruthy();
      await fireEvent.press(screen.getByText('Guardar'));
      expect(props.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ fields: [expect.objectContaining({ label: 'Cancha', required: false })] }),
      );
    });

    it('deja si todos los eventos lo tienen completado', async () => {
      await renderWithStore(<EventTypeForm {...props} initial={torneo} />, {
        types: [torneo],
        fields: [cancha],
        events: [partido(1)],
        fieldValues: { 1: { 3: 'Club Norte' } },
      });

      await fireEvent(screen.getByLabelText('Campo 1 obligatorio'), 'valueChange', true);
      await fireEvent.press(screen.getByText('Guardar'));

      expect(props.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ fields: [expect.objectContaining({ label: 'Cancha', required: true })] }),
      );
    });

    it('un campo nuevo en un tipo con eventos no puede ser obligatorio', async () => {
      await renderWithStore(<EventTypeForm {...props} initial={torneo} />, {
        types: [torneo],
        events: [partido(1)],
      });

      await fireEvent.press(screen.getByLabelText('Agregar campo'));
      await fireEvent(screen.getByLabelText('Campo 1 obligatorio'), 'valueChange', true);

      expect(
        screen.getByText('1 evento no lo tiene completado. Dejalo opcional, o completalo en ese evento y después pasalo a obligatorio.'),
      ).toBeTruthy();
    });
  });
});
