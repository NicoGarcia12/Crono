import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import type { View } from 'react-native';

/**
 * Registro de los elementos que el recorrido guiado puede resaltar (CRONO44).
 *
 * 💡 Aprendizaje: en React Native no hay `document.querySelector` como en la
 * web (lo que usa Driver.js). Para saber dónde está un elemento hay que tener
 * una referencia a su vista nativa y pedirle la medida con `measureInWindow`,
 * que devuelve x/y/ancho/alto en coordenadas de la ventana. `onLayout` avisa
 * cuando el elemento cambió de tamaño o lugar (rotar, teclado, contenido),
 * y ahí se vuelve a medir.
 *
 * Son dos contextos separados a propósito: los elementos solo necesitan las
 * funciones para registrarse (estables, nunca cambian) y el recorrido necesita
 * las medidas. Así, cuando cambia una medida no se vuelven a dibujar la Agenda
 * ni el tab bar, solo el overlay.
 */

/** Rectángulo en coordenadas de ventana. */
export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** La instancia nativa de un `View` (lo que llega a su `ref`). */
export type TourTargetNode = ComponentRef<typeof View>;

interface TourRegistry {
  register: (id: string, node: TourTargetNode | null) => void;
  /** Se resuelve cuando llega la medida (o enseguida si el elemento no está registrado). */
  measure: (id: string) => Promise<void>;
  /** Se resuelve cuando llegaron las medidas de todos los elementos registrados. */
  measureAll: () => Promise<void>;
}

const TourRegistryContext = createContext<TourRegistry | null>(null);
const TourRectsContext = createContext<Readonly<Record<string, TourRect>>>({});

export function TourProvider({ children }: { children: ReactNode }) {
  // Los nodos van en un ref: registrarlos no tiene que provocar renders.
  const nodes = useRef(new Map<string, TourTargetNode>());
  const [rects, setRects] = useState<Readonly<Record<string, TourRect>>>({});

  const setRect = useCallback((id: string, rect: TourRect | null) => {
    setRects((previous) => {
      const current = previous[id];
      if (rect === null) {
        if (!current) return previous;
        const next = { ...previous };
        delete next[id];
        return next;
      }
      // Misma medida → mismo objeto: React no re-renderiza.
      if (
        current &&
        current.x === rect.x &&
        current.y === rect.y &&
        current.width === rect.width &&
        current.height === rect.height
      ) {
        return previous;
      }
      return { ...previous, [id]: rect };
    });
  }, []);

  // Forma con executor y no `Promise.withResolvers`: este código corre en Hermes, y no
  // está confirmado que esa API exista en el motor de este SDK.
  const measure = useCallback(
    (id: string) =>
      new Promise<void>((resolve) => {
        const node = nodes.current.get(id);
        if (!node) {
          resolve();
          return;
        }
        node.measureInWindow((x, y, width, height) => {
          // La medida llega después: si mientras tanto se desmontó, se descarta.
          if (nodes.current.get(id) === node) setRect(id, { x, y, width, height });
          resolve();
        });
      }),
    [setRect],
  );

  const register = useCallback(
    (id: string, node: TourTargetNode | null) => {
      if (node) {
        nodes.current.set(id, node);
        void measure(id);
        return;
      }
      nodes.current.delete(id);
      setRect(id, null);
    },
    [measure, setRect],
  );

  const measureAll = useCallback(async () => {
    await Promise.all([...nodes.current.keys()].map(measure));
  }, [measure]);

  const registry = useMemo<TourRegistry>(() => ({ register, measure, measureAll }), [register, measure, measureAll]);

  return (
    <TourRegistryContext.Provider value={registry}>
      <TourRectsContext.Provider value={rects}>{children}</TourRectsContext.Provider>
    </TourRegistryContext.Provider>
  );
}

/** Props para esparcir sobre un `View`/`Pressable`: `<View {...useTourTarget('agenda-buscar')} />`. */
export interface TourTargetProps {
  ref: (node: TourTargetNode | null) => void;
  onLayout: () => void;
  /** En Android, una vista "solo de layout" puede aplanarse y dejar de existir como nativa: no se podría medir. */
  collapsable: false;
}

/**
 * Registra el elemento como destino del paso `id`. Fuera de un `TourProvider`
 * (ej. una pantalla renderizada sola en un test) no hace nada.
 */
export function useTourTarget(id: string): TourTargetProps {
  const registry = useContext(TourRegistryContext);

  const ref = useCallback((node: TourTargetNode | null) => registry?.register(id, node), [registry, id]);
  const onLayout = useCallback(() => void registry?.measure(id), [registry, id]);

  return useMemo(() => ({ ref, onLayout, collapsable: false as const }), [ref, onLayout]);
}

/** Medidas actuales de los destinos registrados (para el overlay). */
export function useTourRects(): Readonly<Record<string, TourRect>> {
  return useContext(TourRectsContext);
}

/** Pedir medidas de nuevo (al abrir el recorrido, al rotar o al cambiar de paso). */
export function useTourMeasure(): Pick<TourRegistry, 'measure' | 'measureAll'> | null {
  return useContext(TourRegistryContext);
}
