import { fireEvent, render, screen } from '@testing-library/react-native';

import { BirthdayPickList } from '@/components/birthday-pick-list';
import type { BirthdayCandidate } from '@/contacts/birthday-import';

jest.mock('expo-contacts', () => ({}));

const candidates: BirthdayCandidate[] = [
  { key: 'c1', name: 'Ana', date: '2026-12-20', hasYear: false, alreadyImported: false },
  { key: 'c2', name: 'Bruno', date: '1990-03-05', hasYear: true, alreadyImported: false },
  { key: 'c3', name: 'Carla', date: '1988-07-11', hasYear: true, alreadyImported: true },
];

describe('<BirthdayPickList />', () => {
  it('preselecciona solo los que no están en la agenda', async () => {
    await render(<BirthdayPickList candidates={candidates} onImport={jest.fn()} />);

    expect(screen.getByText('Importar 2 cumpleaños')).toBeTruthy();
    expect(screen.getByText('Ya está en tu agenda')).toBeTruthy();
  });

  it('permite destildar un contacto antes de importar', async () => {
    const onImport = jest.fn();
    await render(<BirthdayPickList candidates={candidates} onImport={onImport} />);

    await fireEvent.press(screen.getByLabelText('Cumpleaños de Ana'));
    expect(screen.getByText('Importar 1 cumpleaños')).toBeTruthy();

    await fireEvent.press(screen.getByText('Importar 1 cumpleaños'));
    expect(onImport).toHaveBeenCalledWith([expect.objectContaining({ name: 'Bruno' })]);
  });

  it('no permite importar si no queda nada seleccionado', async () => {
    const onImport = jest.fn();
    await render(<BirthdayPickList candidates={candidates} onImport={onImport} />);

    await fireEvent.press(screen.getByLabelText('Cumpleaños de Ana'));
    await fireEvent.press(screen.getByLabelText('Cumpleaños de Bruno'));

    await fireEvent.press(screen.getByText('Importar 0 cumpleaños'));
    expect(onImport).not.toHaveBeenCalled();
  });

  it('los ya importados no se pueden tocar', async () => {
    const onImport = jest.fn();
    await render(<BirthdayPickList candidates={candidates} onImport={onImport} />);

    await fireEvent.press(screen.getByLabelText('Cumpleaños de Carla'));
    // Carla sigue sin contar para el botón (solo Ana y Bruno).
    expect(screen.getByText('Importar 2 cumpleaños')).toBeTruthy();
  });

  it('expone la lista con el rol accesible list', async () => {
    await render(<BirthdayPickList candidates={candidates} onImport={jest.fn()} />);

    expect(screen.getByRole('list')).toBeTruthy();
  });

  it('expone el botón de importación por nombre accesible', async () => {
    await render(<BirthdayPickList candidates={candidates} onImport={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Importar 2 cumpleaños' })).toBeTruthy();
  });

  it('comunica que el botón está deshabilitado sin candidatos seleccionados', async () => {
    await render(
      <BirthdayPickList
        candidates={[{ ...candidates[2], key: 'solo-importado' }]}
        onImport={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Importar 0 cumpleaños' }).props.accessibilityState).toEqual({
      disabled: true,
    });
  });
});
