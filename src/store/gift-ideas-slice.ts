import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as giftIdeasRepo from '@/db/gift-ideas-repo';
import type { GiftIdea } from '@/types';

/**
 * Slice de ideas de regalo. Solo mantiene las ideas del evento que se está
 * viendo (como greetings-slice con el año): no hace falta cargar todas a la vez.
 */

interface GiftIdeasState {
  eventId: number | null;
  items: GiftIdea[];
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const initialState: GiftIdeasState = { eventId: null, items: [], status: 'idle' };

export const loadGiftIdeas = createAsyncThunk('giftIdeas/load', async (eventId: number) => {
  const items = await giftIdeasRepo.findGiftIdeasByEvent(eventId);
  return { eventId, items };
});

export const addGiftIdea = createAsyncThunk(
  'giftIdeas/add',
  async (payload: { eventId: number; text: string }) => giftIdeasRepo.insertGiftIdea(payload),
);

export const editGiftIdea = createAsyncThunk(
  'giftIdeas/edit',
  async (payload: { id: number; text: string }) => {
    await giftIdeasRepo.updateGiftIdeaText(payload.id, payload.text);
    return payload;
  },
);

export const removeGiftIdea = createAsyncThunk('giftIdeas/remove', async (id: number) => {
  await giftIdeasRepo.deleteGiftIdea(id);
  return id;
});

const giftIdeasSlice = createSlice({
  name: 'giftIdeas',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadGiftIdeas.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadGiftIdeas.fulfilled, (state, action) => {
        state.eventId = action.payload.eventId;
        state.items = action.payload.items;
        state.status = 'ready';
      })
      .addCase(loadGiftIdeas.rejected, (state) => {
        state.status = 'error';
      })
      .addCase(addGiftIdea.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(editGiftIdea.fulfilled, (state, action) => {
        const idea = state.items.find((i) => i.id === action.payload.id);
        if (idea) idea.text = action.payload.text;
      })
      .addCase(removeGiftIdea.fulfilled, (state, action) => {
        state.items = state.items.filter((i) => i.id !== action.payload);
      });
  },
});

export default giftIdeasSlice.reducer;
