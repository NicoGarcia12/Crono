import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Provider } from 'react-redux';

import eventsReducer from '@/store/events-slice';
import notesReducer from '@/store/notes-slice';
import settingsReducer from '@/store/settings-slice';

/**
 * Helper para tests de componentes.
 *
 * 💡 Aprendizaje: desde que los colores salen del tema (y el tema vive en
 * Redux), cualquier componente con estilos necesita el <Provider> para
 * renderizar. Este helper evita repetir ese armado en cada test.
 */
export function renderWithStore(ui: ReactElement) {
  const store = configureStore({
    reducer: { events: eventsReducer, notes: notesReducer, settings: settingsReducer },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return render(ui, { wrapper: Wrapper });
}
