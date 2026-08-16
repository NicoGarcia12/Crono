import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';

import eventsReducer from '@/store/events-slice';
import giftIdeasReducer from '@/store/gift-ideas-slice';
import greetingsReducer from '@/store/greetings-slice';
import greetingsSentReducer from '@/store/greetings-sent-slice';
import notesReducer from '@/store/notes-slice';
import settingsReducer from '@/store/settings-slice';

/**
 * Store global (Redux Toolkit).
 *
 * 💡 Aprendizaje: igual que en React web. Los "hooks tipados" de abajo
 * evitan repetir los tipos en cada componente — usá SIEMPRE useAppDispatch
 * y useAppSelector en vez de los genéricos de react-redux.
 */
export const store = configureStore({
  reducer: {
    events: eventsReducer,
    giftIdeas: giftIdeasReducer,
    greetings: greetingsReducer,
    greetingsSent: greetingsSentReducer,
    notes: notesReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
