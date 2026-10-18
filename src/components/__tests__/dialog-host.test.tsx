import { act, fireEvent, screen } from '@testing-library/react-native';

import {
  confirmAction,
  confirmDestructive,
  currentDialog,
  notify,
  resolveDialog,
  showError,
} from '@/components/confirm';
import { DialogHost } from '@/components/dialog-host';
import { renderWithStore } from '@/test-utils';

// La cola de diálogos es global: si un test falla con uno abierto, no debe pasar al siguiente.
afterEach(() => {
  for (let dialog = currentDialog(); dialog; dialog = currentDialog()) resolveDialog(dialog.id, false);
});

describe('<DialogHost />', () => {
  it('no muestra nada si no hay diálogos pedidos', async () => {
    await renderWithStore(<DialogHost />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('confirmDestructive resuelve true al confirmar', async () => {
    await renderWithStore(<DialogHost />);

    let result: Promise<boolean> | undefined;
    await act(async () => {
      result = confirmDestructive('Borrar tipo', '¿Borrar "Mascota"?', 'Borrar');
    });

    expect(screen.getByText('Borrar tipo')).toBeTruthy();
    expect(screen.getByText('¿Borrar "Mascota"?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Borrar' }));

    await expect(result).resolves.toBe(true);
    expect(screen.queryByText('Borrar tipo')).toBeNull();
  });

  it('confirmAction resuelve false al cancelar, con la etiqueta pedida', async () => {
    await renderWithStore(<DialogHost />);

    let result: Promise<boolean> | undefined;
    await act(async () => {
      result = confirmAction('¿Cargar el dato?', 'Hay un campo nuevo.', 'Cargar');
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Ahora no' }));

    await expect(result).resolves.toBe(false);
  });

  it('el botón atrás de Android cancela', async () => {
    await renderWithStore(<DialogHost />);

    let result: Promise<boolean> | undefined;
    await act(async () => {
      result = confirmDestructive('Eliminar nota', '¿Seguro?', 'Eliminar');
    });

    // `onRequestClose` es lo que dispara el botón "atrás" sobre un Modal.
    await fireEvent(screen.getByText('Eliminar nota'), 'requestClose');

    await expect(result).resolves.toBe(false);
  });

  it('muestra los avisos de a uno, en el orden en que se pidieron', async () => {
    await renderWithStore(<DialogHost />);

    await act(async () => {
      notify('Listo', 'Se restauraron 3 eventos.');
      showError('No se pudo guardar', { message: 'Disco lleno' });
    });

    expect(screen.getByText('Listo')).toBeTruthy();
    expect(screen.queryByText('No se pudo guardar')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Entendido' }));

    expect(screen.getByText('No se pudo guardar')).toBeTruthy();
    expect(screen.getByText('Disco lleno')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('button')).toBeNull();
  });
});
