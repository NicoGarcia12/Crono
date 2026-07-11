import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as notesRepo from '@/db/notes-repo';
import type { NewNote, Note } from '@/types';

/** Slice de notas personales. Mismo patrón que events-slice, sin notificaciones. */

interface NotesState {
  items: Note[];
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const initialState: NotesState = { items: [], status: 'idle' };

export const loadNotes = createAsyncThunk('notes/load', async () => {
  return notesRepo.findAllNotes();
});

export const addNote = createAsyncThunk('notes/add', async (data: NewNote) => {
  return notesRepo.insertNote(data);
});

export const editNote = createAsyncThunk('notes/edit', async (payload: { id: number; data: NewNote }) => {
  return notesRepo.updateNote(payload.id, payload.data);
});

export const removeNote = createAsyncThunk('notes/remove', async (id: number) => {
  await notesRepo.deleteNote(id);
  return id;
});

const notesSlice = createSlice({
  name: 'notes',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadNotes.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadNotes.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = 'ready';
      })
      .addCase(loadNotes.rejected, (state) => {
        state.status = 'error';
      })
      .addCase(addNote.fulfilled, (state, action) => {
        // La lista se ordena por última modificación: la nueva va primera.
        state.items.unshift(action.payload);
      })
      .addCase(editNote.fulfilled, (state, action) => {
        state.items = [action.payload, ...state.items.filter((n) => n.id !== action.payload.id)];
      })
      .addCase(removeNote.fulfilled, (state, action) => {
        state.items = state.items.filter((n) => n.id !== action.payload);
      });
  },
});

export default notesSlice.reducer;
