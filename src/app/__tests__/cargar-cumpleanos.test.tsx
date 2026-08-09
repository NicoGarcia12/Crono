import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import CargarCumpleanosScreen from '@/app/cargar-cumpleanos';
import { fetchContacts, type ContactCandidate } from '@/contacts/birthday-import';
import { addContactBirthdays } from '@/store/events-slice';

const mockBack = jest.fn();
const mockDispatch = jest.fn(() => ({ unwrap: jest.fn().mockResolvedValue([]) }));

jest.mock('expo-contacts', () => ({}));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('@/store', () => ({
  store: { getState: () => ({ events: { items: [] } }) },
  useAppDispatch: () => mockDispatch,
}));
jest.mock('@/store/events-slice', () => ({
  addContactBirthdays: jest.fn(),
  removeEvent: jest.fn(),
}));
jest.mock('@/contacts/birthday-import', () => ({
  ...jest.requireActual<typeof import('@/contacts/birthday-import')>('@/contacts/birthday-import'),
  fetchContacts: jest.fn(),
}));

const ana: ContactCandidate = {
  key: 'contact-ana',
  name: 'Ana',
  phone: '+54 11 5555-0001',
  suggestedDate: '1995-12-20',
  suggestedHasYear: true,
  loaded: null,
};

describe('<CargarCumpleanosScreen />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(fetchContacts).mockResolvedValue({ status: 'ok', candidates: [ana] });
  });

  it('despacha un único lote al finalizar el asistente', async () => {
    await render(<CargarCumpleanosScreen />);

    await fireEvent.press(await screen.findByLabelText('Contacto Ana'));
    await fireEvent.press(screen.getByText('Cargar 1 cumpleaños'));
    await fireEvent.press(screen.getByText('Guardar y terminar'));

    await waitFor(() =>
      expect(jest.mocked(addContactBirthdays)).toHaveBeenCalledWith([
        {
          title: 'Ana',
          type: 'cumpleanos',
          date: '1995-12-20',
          time: null,
          description: null,
          contactId: 'contact-ana',
          phone: '+54 11 5555-0001',
          reminders: [{ amount: 1, unit: 'dias' }],
          yearly: 1,
        },
      ]),
    );
  });
});
