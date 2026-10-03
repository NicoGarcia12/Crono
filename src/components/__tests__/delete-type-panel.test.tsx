import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { DeleteTypePanel } from '@/components/delete-type-panel';
import { DEFAULT_EVENT_BASES } from '@/constants/event-bases';
import eventBasesReducer from '@/store/event-bases-slice';
import eventTypesReducer from '@/store/event-types-slice';
import eventsReducer from '@/store/events-slice';
import settingsReducer from '@/store/settings-slice';
import type { EventItem, EventTypeMeta } from '@/types';

jest.mock('@/components/confirm', () => ({
  confirmDestructive: jest.fn().mockResolvedValue(false),
  impactMessage: jest.fn(() => ''),
}));
jest.mock('@/store/type-config-thunks', () => ({
  countRemovals: jest.fn().mockResolvedValue({ events: 0, items: [] }),
  createTypeConfig: jest.fn(),
  deleteTypeMovingEvents: jest.fn(),
  deleteTypeWithEvents: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { confirmDestructive } = require('@/components/confirm');

const type = (over: Partial<EventTypeMeta>): EventTypeMeta => ({
  id: 1, key: 'x', label: 'X', icon: 'star', color: '#000',
  defaultYearly: false, isBuiltin: false, baseKey: 'evento', extraCapabilities: [], hidden: false, ...over,
});
const torneo = type({ id: 20, key: 'torneo', label: 'Torneo' });
const evento = type({ id: 1, key: 'evento', label: 'Evento', isBuiltin: true });
const festivo = type({ id: 4, key: 'festivo', label: 'Día festivo', baseKey: 'festivo', isBuiltin: true });

const event = (id: number, typeKey: string): EventItem => ({
  id, title: `E${id}`, type: typeKey, date: '2026-11-11', time: null, description: null, contactId: null,
  phone: null, reminders: [], yearly: 0, isMine: 0, tags: [], photoUri: null, yearUnknown: 0,
});

function renderPanel(target: EventTypeMeta, types: EventTypeMeta[]) {
  const store = configureStore({
    reducer: { events: eventsReducer, eventBases: eventBasesReducer, eventTypes: eventTypesReducer, settings: settingsReducer },
    preloadedState: {
      events: { items: [event(1, target.key), event(2, target.key), event(3, 'otro')], status: 'ready' as const },
      eventBases: {
        bases: Object.entries(DEFAULT_EVENT_BASES).map(([key, b], i) => ({ id: i + 1, key, ...b, isBuiltin: true })),
        fields: [],
        status: 'ready' as const,
      },
      eventTypes: { items: types, status: 'ready' as const },
    },
  });
  return render(
    <Provider store={store}>
      <DeleteTypePanel type={target} onDone={jest.fn()} onCancel={jest.fn()} />
    </Provider>,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('<DeleteTypePanel />', () => {
  it('avisa cuántos eventos tiene y pregunta si moverlos', async () => {
    await renderPanel(torneo, [evento, torneo]);

    expect(screen.getByText('Tiene 2 eventos. ¿Querés moverlos a otro tipo?')).toBeTruthy();
  });

  it('al mover, ofrece solo los tipos de la misma base', async () => {
    await renderPanel(torneo, [evento, festivo, torneo]);

    await fireEvent.press(screen.getByText('Sí, moverlos'));

    expect(screen.getByLabelText('Mover a Evento')).toBeTruthy();
    expect(screen.queryByLabelText('Mover a Día festivo')).toBeNull();
  });

  it('si no hay otro tipo con esa base, ofrece crear uno nuevo y moverlos', async () => {
    await renderPanel(festivo, [evento, festivo]);

    await fireEvent.press(screen.getByText('Sí, moverlos'));

    expect(screen.getByText('No hay otro tipo con la base Festivo.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Crear nuevo tipo y moverlos'));
    expect(screen.getByLabelText('Nombre del tipo')).toBeTruthy();
    expect(screen.getByText('Festivo · la base no cambia después de crear el tipo')).toBeTruthy();
  });

  it('no mover pide confirmar el borrado de los eventos, y cancelar no borra nada', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const thunks = require('@/store/type-config-thunks');
    await renderPanel(torneo, [evento, torneo]);

    await fireEvent.press(screen.getByText('No, borrarlos'));

    expect(confirmDestructive).toHaveBeenCalledWith(
      'Borrar tipo y eventos',
      expect.stringContaining('Se borran los 2 eventos de "Torneo"'),
      'Borrar todo',
    );
    expect(thunks.deleteTypeWithEvents).not.toHaveBeenCalled();
  });
});
