import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import EditarNotaScreen from '@/app/nota/[id]';
import NuevaNotaScreen from '@/app/nota/nueva';
import { currentDialog, resolveDialog } from '@/components/confirm';
import { DialogHost } from '@/components/dialog-host';
import * as notesRepo from '@/db/notes-repo';
import notesReducer from '@/store/notes-slice';
import settingsReducer from '@/store/settings-slice';
import type { Note } from '@/types';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ id: '7' }),
  Stack: {
    Screen: ({ options }: { options: { headerRight?: () => ReactNode } }) => options.headerRight?.() ?? null,
  },
}));

// El glifo y su carga nativa no forman parte del contrato del botón accesible.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

// Jest no ejecuta SQLite nativo: sólo reemplazamos el borde de persistencia;
// formulario, thunks, reducers y diálogos siguen siendo los de producción.
jest.mock('@/db/notes-repo');

const original: Note = {
  id: 7,
  title: 'Compras',
  content: 'Leche',
  createdAt: '2026-10-20T10:00:00.000Z',
  updatedAt: '2026-10-20T10:00:00.000Z',
};
const draft = { title: 'Pendientes', content: 'Llamar mañana' };
const saved: Note = { ...original, ...draft, updatedAt: '2026-10-28T10:00:00.000Z' };

async function renderScreen(editing: boolean) {
  const store = configureStore({
    reducer: { notes: notesReducer, settings: settingsReducer },
    preloadedState: { notes: { items: editing ? [original] : [], status: 'ready' as const } },
  });
  await render(
    <Provider store={store}>
      {editing ? <EditarNotaScreen /> : <NuevaNotaScreen />}
      <DialogHost />
    </Provider>,
  );
  return store;
}

async function fillDraft(): Promise<void> {
  await fireEvent.changeText(screen.getByPlaceholderText('Título'), `  ${draft.title}  `);
  await fireEvent.changeText(screen.getByPlaceholderText('Escribí tu nota…'), `  ${draft.content}  `);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(notesRepo.insertNote).mockReset();
  jest.mocked(notesRepo.updateNote).mockReset();
  jest.mocked(notesRepo.deleteNote).mockReset();
});

afterEach(async () => {
  // Los diálogos viven fuera de React; evitamos filtrarlos al próximo caso.
  await act(() => {
    let dialog = currentDialog();
    while (dialog) {
      resolveDialog(dialog.id, false);
      dialog = currentDialog();
    }
  });
});

it('no guarda una nota sin título', async () => {
  await renderScreen(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar nota' }));
  expect(notesRepo.insertNote).not.toHaveBeenCalled();
  expect(mockBack).not.toHaveBeenCalled();
});

describe.each([
  { name: 'crear', editing: false, label: 'Guardar nota' },
  { name: 'editar', editing: true, label: 'Guardar cambios' },
])('$name una nota', ({ editing, label }) => {
  it('espera persistencia, bloquea doble envío y confirma lista/navegación una sola vez', async () => {
    const pending = Promise.withResolvers<Note>();
    jest.mocked(notesRepo.insertNote).mockReturnValue(pending.promise);
    jest.mocked(notesRepo.updateNote).mockReturnValue(pending.promise);
    const store = await renderScreen(editing);
    await fillDraft();
    const submit = screen.getByRole('button', { name: label });

    await fireEvent.press(submit);
    await fireEvent.press(submit);
    const persist = editing ? notesRepo.updateNote : notesRepo.insertNote;
    expect(persist).toHaveBeenCalledTimes(1);
    expect(store.getState().notes.items).toEqual(editing ? [original] : []);
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Título').props.editable).toBe(false);
    if (editing) {
      await fireEvent.press(screen.getByRole('button', { name: 'Eliminar nota' }));
      expect(currentDialog()).toBeNull();
      expect(notesRepo.deleteNote).not.toHaveBeenCalled();
    }

    await act(() => pending.resolve(saved));
    expect(store.getState().notes.items).toEqual([saved]);
    expect(mockBack).toHaveBeenCalledTimes(1);
    // Aunque el navegador demore el desmontaje, el envío ya confirmado no se repite.
    await fireEvent.press(submit);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('conserva el borrador ante rechazo y permite reintentar sin falsa confirmación', async () => {
    const pending = Promise.withResolvers<Note>();
    jest.mocked(notesRepo.insertNote).mockReturnValueOnce(pending.promise).mockResolvedValue(saved);
    jest.mocked(notesRepo.updateNote).mockReturnValueOnce(pending.promise).mockResolvedValue(saved);
    const store = await renderScreen(editing);
    await fillDraft();
    await fireEvent.press(screen.getByRole('button', { name: label }));

    await act(() => pending.reject(new Error('Disco ocupado')));
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByPlaceholderText('Título')).toHaveDisplayValue(`  ${draft.title}  `);
    expect(screen.getByPlaceholderText('Escribí tu nota…')).toHaveDisplayValue(`  ${draft.content}  `);
    expect(screen.getByPlaceholderText('Título').props.editable).toBe(true);
    expect(store.getState().notes.items).toEqual(editing ? [original] : []);
    expect(mockBack).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: label }));
    if (editing) {
      expect(notesRepo.updateNote).toHaveBeenLastCalledWith(original.id, draft);
      expect(notesRepo.updateNote).toHaveBeenCalledTimes(2);
    } else {
      expect(notesRepo.insertNote).toHaveBeenLastCalledWith(draft);
      expect(notesRepo.insertNote).toHaveBeenCalledTimes(2);
    }
    expect(store.getState().notes.items).toEqual([saved]);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

it('cancelar borrado conserva borrador y vuelve a permitir guardar', async () => {
  jest.mocked(notesRepo.updateNote).mockResolvedValue(saved);
  const store = await renderScreen(true);
  await fillDraft();
  const submit = screen.getByRole('button', { name: 'Guardar cambios' });
  const remove = screen.getByRole('button', { name: 'Eliminar nota' });
  await fireEvent.press(remove);
  await fireEvent.press(remove);
  await fireEvent.press(submit);
  expect(notesRepo.updateNote).not.toHaveBeenCalled();
  expect(notesRepo.deleteNote).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
  expect(currentDialog()).toBeNull();
  expect(store.getState().notes.items).toEqual([original]);
  expect(screen.getByPlaceholderText('Título')).toHaveDisplayValue(`  ${draft.title}  `);
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(notesRepo.updateNote).toHaveBeenCalledTimes(1);
  expect(mockBack).toHaveBeenCalledTimes(1);
});

it('borrar espera confirmación real; un fallo mantiene nota y borrador y permite reintentar', async () => {
  const pending = Promise.withResolvers<void>();
  jest.mocked(notesRepo.deleteNote).mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
  const store = await renderScreen(true);
  await fillDraft();
  const remove = screen.getByRole('button', { name: 'Eliminar nota' });
  await fireEvent.press(remove);
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar' }));
  await fireEvent.press(remove);
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(notesRepo.deleteNote).toHaveBeenCalledTimes(1);
  expect(notesRepo.updateNote).not.toHaveBeenCalled();
  expect(store.getState().notes.items).toEqual([original]);
  expect(mockBack).not.toHaveBeenCalled();

  await act(() => pending.reject(new Error('Disco ocupado')));
  expect(await screen.findByRole('button', { name: 'Entendido' })).toBeVisible();
  expect(store.getState().notes.items).toEqual([original]);
  expect(mockBack).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Entendido' }));
  expect(screen.getByPlaceholderText('Título')).toHaveDisplayValue(`  ${draft.title}  `);
  expect(screen.getByPlaceholderText('Escribí tu nota…')).toHaveDisplayValue(`  ${draft.content}  `);

  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar nota' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar' }));
  expect(notesRepo.deleteNote).toHaveBeenCalledTimes(2);
  expect(notesRepo.deleteNote).toHaveBeenLastCalledWith(original.id);
  expect(store.getState().notes.items).toEqual([]);
  expect(mockBack).toHaveBeenCalledTimes(1);
});
