import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Provider } from 'react-redux';

import { DEFAULT_EVENT_TYPES } from '@/constants/event-types';
import eventTypesReducer from '@/store/event-types-slice';
import eventsReducer from '@/store/events-slice';
import giftIdeasReducer from '@/store/gift-ideas-slice';
import greetingsReducer from '@/store/greetings-slice';
import greetingsSentReducer from '@/store/greetings-sent-slice';
import notesReducer from '@/store/notes-slice';
import settingsReducer from '@/store/settings-slice';

/** Mismos 5 tipos que siembra la migración — para que los componentes vean los mismos label/ícono/color que en la app real. */
const defaultEventTypes = Object.entries(DEFAULT_EVENT_TYPES).map(([key, meta], index) => ({
  id: index + 1,
  key,
  ...meta,
  isBuiltin: true,
}));

/**
 * Helper para tests de componentes.
 *
 * 💡 Aprendizaje: desde que los colores salen del tema (y el tema vive en
 * Redux), cualquier componente con estilos necesita el <Provider> para
 * renderizar. Este helper evita repetir ese armado en cada test.
 */
export function renderWithStore(ui: ReactElement) {
  const store = configureStore({
    reducer: {
      events: eventsReducer,
      eventTypes: eventTypesReducer,
      giftIdeas: giftIdeasReducer,
      greetings: greetingsReducer,
      greetingsSent: greetingsSentReducer,
      notes: notesReducer,
      settings: settingsReducer,
    },
    preloadedState: {
      eventTypes: { items: defaultEventTypes, status: 'ready' as const },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return render(ui, { wrapper: Wrapper });
}
