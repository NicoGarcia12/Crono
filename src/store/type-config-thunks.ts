import { createAsyncThunk } from '@reduxjs/toolkit';

import * as customFieldsRepo from '@/db/custom-fields-repo';
import * as eventBasesRepo from '@/db/event-bases-repo';
import * as eventTypesRepo from '@/db/event-types-repo';
import { loadEventBases } from '@/store/event-bases-slice';
import { loadEventTypes } from '@/store/event-types-slice';
import { loadEvents } from '@/store/events-slice';
import { loadFieldValues } from '@/store/field-values-slice';
import type { NewEventBase, NewEventType, RemovalPlan } from '@/types';

/**
 * Guardar un tipo o una base puede cambiar varias cosas a la vez (campos,
 * teléfonos borrados, valores podados). En vez de parchear cada slice a mano,
 * después de escribir se recarga todo lo que pudo cambiar desde SQLite.
 *
 * 💡 Aprendizaje: estos thunks viven aparte de los slices para no armar
 * imports circulares (el slice de tipos no tiene por qué conocer al de eventos).
 */

type Dispatch = (action: unknown) => unknown;

async function reloadAll(dispatch: Dispatch) {
  await Promise.all([
    dispatch(loadEventBases()),
    dispatch(loadEventTypes()),
    dispatch(loadEvents()),
    dispatch(loadFieldValues()),
  ]);
}

export const createTypeConfig = createAsyncThunk(
  'typeConfig/createType',
  async (data: NewEventType, { dispatch }) => {
    const created = await eventTypesRepo.createEventType(data);
    await reloadAll(dispatch);
    return created;
  },
);

export const saveTypeConfig = createAsyncThunk(
  'typeConfig/saveType',
  async (payload: { id: number; data: NewEventType; plan: RemovalPlan }, { dispatch }) => {
    await eventTypesRepo.updateEventType(payload.id, payload.data, payload.plan);
    await reloadAll(dispatch);
  },
);

export const createBaseConfig = createAsyncThunk(
  'typeConfig/createBase',
  async (data: NewEventBase, { dispatch }) => {
    const created = await eventBasesRepo.createEventBase(data);
    await reloadAll(dispatch);
    return created;
  },
);

export const saveBaseConfig = createAsyncThunk(
  'typeConfig/saveBase',
  async (payload: { id: number; data: NewEventBase; plan: RemovalPlan }, { dispatch }) => {
    await eventBasesRepo.updateEventBase(payload.id, payload.data, payload.plan);
    await reloadAll(dispatch);
  },
);

/** Conteo para el aviso previo: no modifica nada. */
export const countRemovals = (
  typeKeys: readonly string[],
  plan: RemovalPlan,
  fieldLabels: Readonly<Record<number, string>>,
) => customFieldsRepo.countRemovalImpact(typeKeys, plan, fieldLabels);
