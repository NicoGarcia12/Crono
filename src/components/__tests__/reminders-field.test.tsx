import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithStore } from '@/test-utils';

import { RemindersField } from '@/components/reminders-field';
import type { ReminderInput } from '@/types';

describe('<RemindersField />', () => {
  const renderField = async (value: ReminderInput[] = []) => {
    const onChange = jest.fn();
    await renderWithStore(<RemindersField value={value} onChange={onChange} />);
    return onChange;
  };

  it('muestra un texto guía cuando no hay avisos', async () => {
    await renderField([]);

    expect(screen.getByText('Sin recordatorios. Agregá los que quieras.')).toBeTruthy();
  });

  it('agrega un aviso desde los atajos', async () => {
    const onChange = await renderField([]);

    await fireEvent.press(screen.getByText('1 semana antes'));

    expect(onChange).toHaveBeenCalledWith([{ amount: 1, unit: 'semanas' }]);
  });

  it('arma un aviso a medida: número + unidad', async () => {
    const onChange = await renderField([]);

    await fireEvent.changeText(screen.getByLabelText('Cantidad del recordatorio'), '3');
    await fireEvent.press(screen.getByLabelText('semanas'));
    await fireEvent.press(screen.getByText('Agregar recordatorio'));

    expect(onChange).toHaveBeenCalledWith([{ amount: 3, unit: 'semanas' }]);
  });

  it('ordena los avisos del más lejano al más cercano', async () => {
    const onChange = await renderField([{ amount: 1, unit: 'horas' }]);

    await fireEvent.press(screen.getByText('1 mes antes'));

    expect(onChange).toHaveBeenCalledWith([
      { amount: 1, unit: 'meses' },
      { amount: 1, unit: 'horas' },
    ]);
  });

  it('no duplica un aviso que ya está elegido', async () => {
    // El atajo de "1 día antes" no se ofrece si ya está en la lista.
    await renderField([{ amount: 1, unit: 'dias' }]);

    expect(screen.queryByText('1 día antes')).toBeTruthy(); // aparece como chip elegido
    expect(screen.getAllByText('1 día antes')).toHaveLength(1); // pero no también como atajo
  });

  it('permite quitar un aviso elegido', async () => {
    const onChange = await renderField([
      { amount: 1, unit: 'meses' },
      { amount: 1, unit: 'dias' },
    ]);

    await fireEvent.press(screen.getByLabelText('Quitar aviso 1 mes antes'));

    expect(onChange).toHaveBeenCalledWith([{ amount: 1, unit: 'dias' }]);
  });

  it('no agrega si el número está vacío o es inválido', async () => {
    const onChange = await renderField([]);

    await fireEvent.press(screen.getByText('Agregar recordatorio'));
    await fireEvent.changeText(screen.getByLabelText('Cantidad del recordatorio'), '0');
    await fireEvent.press(screen.getByText('Agregar recordatorio'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
