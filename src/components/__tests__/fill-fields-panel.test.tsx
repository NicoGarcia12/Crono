import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { FillFieldsPanel } from '@/components/fill-fields-panel';
import eventBasesReducer from '@/store/event-bases-slice';
import eventsReducer from '@/store/events-slice';
import fieldValuesReducer from '@/store/field-values-slice';
import settingsReducer from '@/store/settings-slice';
import type { CustomField, EventItem } from '@/types';

jest.mock('@/db/custom-fields-repo', () => ({
  saveEventFieldValues: jest.fn(async (_eventId: number, values: Record<number, string>) => values),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { saveEventFieldValues } = require('@/db/custom-fields-repo');

const event = (id: number, title: string): EventItem => ({
  id, title, type: 'torneo', date: '2026-11-11', time: null, description: null, contactId: null,
  phone: null, reminders: [], yearly: 0, isMine: 0, tags: [], photoUri: null, yearUnknown: 0,
});
const cancha: CustomField = { id: 9, owner: 'type', ownerId: 20, label: 'Cancha', kind: 'numero', options: [], position: 0 };

async function renderPanel(onDone = jest.fn()) {
  const store = configureStore({
    reducer: { events: eventsReducer, eventBases: eventBasesReducer, fieldValues: fieldValuesReducer, settings: settingsReducer },
    preloadedState: {
      events: { items: [event(1, 'Final'), event(2, 'Semifinal')], status: 'ready' as const },
      eventBases: { bases: [], fields: [cancha], status: 'ready' as const },
      // La Final ya tenía otro dato cargado: no se tiene que perder.
      fieldValues: { byEvent: { 1: { 5: 'Club' } }, status: 'ready' as const },
    },
  });
  await render(
    <Provider store={store}>
      <FillFieldsPanel eventIds={[1, 2]} fieldIds={[9]} onDone={onDone} />
    </Provider>,
  );
  return onDone;
}

beforeEach(() => jest.clearAllMocks());

describe('<FillFieldsPanel />', () => {
  it('recorre los eventos de a uno y guarda sumando a lo que ya tenían', async () => {
    const onDone = await renderPanel();

    expect(screen.getByText('Evento 1 de 2')).toBeTruthy();
    expect(screen.getByText('Final')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Cancha'), '3');
    await fireEvent.press(screen.getByText('Guardar y seguir'));

    expect(saveEventFieldValues).toHaveBeenCalledWith(1, { 5: 'Club', 9: '3' });
    expect(screen.getByText('Evento 2 de 2')).toBeTruthy();
    expect(screen.getByText('Semifinal')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('se puede saltear un evento sin guardar nada', async () => {
    await renderPanel();

    await fireEvent.press(screen.getByText('Saltear'));

    expect(saveEventFieldValues).not.toHaveBeenCalled();
    expect(screen.getByText('Semifinal')).toBeTruthy();
  });

  it('terminar corta el recorrido', async () => {
    const onDone = await renderPanel();

    await fireEvent.press(screen.getByText('Terminar'));

    expect(onDone).toHaveBeenCalled();
  });
});
