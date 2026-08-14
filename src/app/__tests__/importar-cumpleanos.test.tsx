import { fireEvent, render, screen } from '@testing-library/react-native';

import ImportarCumpleanosScreen from '@/app/importar-cumpleanos';
import { fetchBirthdayCandidates, type FetchCandidatesResult } from '@/contacts/birthday-import';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@/contacts/birthday-import', () => ({
  fetchBirthdayCandidates: jest.fn(),
  candidateToEvent: jest.fn(),
}));
jest.mock('@/store', () => ({
  store: { getState: () => ({ events: { items: [] } }) },
  useAppDispatch: () => jest.fn(),
}));

const mockFetchBirthdayCandidates = jest.mocked(fetchBirthdayCandidates);

describe('<ImportarCumpleanosScreen />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('permite reintentar la lectura de contactos tras denegar el permiso', async () => {
    mockFetchBirthdayCandidates
      .mockResolvedValueOnce({ status: 'denied' })
      .mockResolvedValueOnce({
        status: 'ok',
        candidates: [
          { key: 'ana', name: 'Ana', date: '2026-12-20', hasYear: false, alreadyImported: false },
        ],
      });

    await render(<ImportarCumpleanosScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Reintentar acceso a contactos' }));

    expect(await screen.findByText('Ana')).toBeTruthy();
  });
});
