import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithStore } from '@/test-utils';

import { ContactPickList } from '@/components/contact-pick-list';
import type { ContactCandidate } from '@/contacts/birthday-import';

jest.mock('expo-contacts', () => ({}));

const candidato = (over: Partial<ContactCandidate> & { key: string; name: string }): ContactCandidate => ({
  phone: null,
  suggestedDate: null,
  suggestedHasYear: false,
  loaded: null,
  ...over,
});

const candidates: ContactCandidate[] = [
  candidato({ key: 'c1', name: 'Ana', suggestedDate: '1995-12-20', suggestedHasYear: true }),
  candidato({ key: 'c2', name: 'Bruno', phone: '+54 11 5555-0002' }),
  candidato({ key: 'c3', name: 'Carla', loaded: { eventId: 5, date: '1988-07-11' } }),
];

describe('<ContactPickList />', () => {
  it('lista todos los contactos y muestra los ya cargados con su fecha', async () => {
    await renderWithStore(<ContactPickList candidates={candidates} onContinue={jest.fn()} onDelete={jest.fn()} />);

    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Bruno')).toBeTruthy();
    expect(screen.getByText('Ya cargado · lunes 11 de julio de 1988')).toBeTruthy();
  });

  it('arranca sin nadie seleccionado', async () => {
    await renderWithStore(<ContactPickList candidates={candidates} onContinue={jest.fn()} onDelete={jest.fn()} />);

    expect(screen.getByText('Cargar 0 cumpleaños')).toBeTruthy();
  });

  it('permite elegir contactos y continuar con los seleccionados', async () => {
    const onContinue = jest.fn();
    await renderWithStore(<ContactPickList candidates={candidates} onContinue={onContinue} onDelete={jest.fn()} />);

    await fireEvent.press(screen.getByLabelText('Contacto Ana'));
    await fireEvent.press(screen.getByLabelText('Contacto Bruno'));
    expect(screen.getByText('Cargar 2 cumpleaños')).toBeTruthy();

    await fireEvent.press(screen.getByText('Cargar 2 cumpleaños'));

    expect(onContinue).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Ana' }),
      expect.objectContaining({ name: 'Bruno' }),
    ]);
  });

  it('deja borrar el cumpleaños de un contacto ya cargado', async () => {
    const onDelete = jest.fn();
    await renderWithStore(<ContactPickList candidates={candidates} onContinue={jest.fn()} onDelete={onDelete} />);

    await fireEvent.press(screen.getByLabelText('Borrar cumpleaños de Carla'));

    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ name: 'Carla' }));
  });

  it('filtra la lista con el buscador', async () => {
    await renderWithStore(<ContactPickList candidates={candidates} onContinue={jest.fn()} onDelete={jest.fn()} />);

    await fireEvent.changeText(screen.getByLabelText('Buscar contacto'), 'bru');

    expect(screen.getByText('Bruno')).toBeTruthy();
    expect(screen.queryByText('Ana')).toBeNull();
  });
});
