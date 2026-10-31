import { Platform } from "react-native";

import { remindersAvailable } from "@/notifications/notifications";

/**
 * Pasos del recorrido guiado de primer uso sobre Agenda (CRONO44).
 *
 * Cada paso apunta a un elemento registrado con `useTourTarget(id)`.
 * Si ese elemento no está montado o no se puede medir (ej. el filtro por
 * etiqueta no aparece hasta que exista alguna), el paso se omite solo.
 * Solo la tarjeta inicial (`TOUR_NOTICE` + `TOUR_QUESTION`) va en el globo
 * centrado, sin resaltar nada.
 */
export interface TourStep {
  id: string;
  /** Id con el que el elemento se registró en `useTourTarget`. */
  target: string;
  title: string;
  body: string;
}

/** Ids de los elementos medibles: un solo lugar para que pantalla y pasos no se desincronicen. */
export const TOUR_TARGETS = {
  search: "agenda-buscar",
  typeFilters: "agenda-filtro-tipos",
  tagFilters: "agenda-filtro-etiquetas",
  list: "agenda-lista",
  add: "agenda-agregar",
  tabAgenda: "tab-agenda",
  tabCalendar: "tab-calendario",
  tabNotes: "tab-notas",
  tabProfile: "tab-perfil",
} as const;

const isWeb = Platform.OS === "web";

/** Límites reales de los avisos y de "los datos quedan en tu dispositivo". */
const noticeBody = isWeb
  ? "En la web Crono no manda avisos: para recibirlos, usá la app en Android o iOS. Aun así, no la uses como único recordatorio para algo importante. " +
    "Tus datos quedan en este navegador; solo salen si exportás una copia o compartís algo."
  : (remindersAvailable
      ? "Los avisos dependen del permiso de notificaciones y de la configuración del celular (como No molestar o el ahorro de batería), así que no uses Crono como único recordatorio para algo importante. "
      : "En esta versión no se programan avisos, así que no uses Crono como único recordatorio para algo importante. ") +
    "Tus datos quedan en este celular, salvo lo que exportes o compartas y lo que copie la copia de seguridad del sistema.";

/**
 * Primer bloque de la tarjeta inicial: los avisos van antes de la pregunta para
 * que se lean aunque se responda "No, gracias". No se repiten en los pasos.
 */
export const TOUR_NOTICE = {
  title: "Antes de empezar",
  body: noticeBody,
} as const;

/**
 * Pregunta de la tarjeta inicial, debajo de los avisos: la primera vez el
 * recorrido no arranca solo, se ofrece. Hace de bienvenida (por eso los pasos
 * empiezan directo por el buscador) y no cuenta como paso.
 */
export const TOUR_QUESTION = {
  title: "¿Querés un recorrido por la app?",
  body: "Un paseo cortito por la Agenda y las pestañas. Si ahora no, lo podés ver cuando quieras desde Perfil, con el botón ?.",
} as const;

export const AGENDA_TOUR_STEPS: TourStep[] = [
  {
    id: "buscar",
    target: TOUR_TARGETS.search,
    title: "Buscá en tu agenda",
    body: "Escribí un nombre, un tipo o parte de la descripción y la lista se filtra al toque.",
  },
  {
    id: "filtro-tipos",
    target: TOUR_TARGETS.typeFilters,
    title: "Filtrá por tipo",
    body: "Mirá solo cumpleaños, aniversarios, citas médicas o el tipo que elijas. «Todos» vuelve a la lista completa.",
  },
  {
    id: "filtro-etiquetas",
    target: TOUR_TARGETS.tagFilters,
    title: "Filtrá por etiqueta",
    body: "Las etiquetas que les pongas a tus eventos aparecen acá para ver solo los de una.",
  },
  {
    id: "lista",
    target: TOUR_TARGETS.list,
    title: "Lo que se viene",
    body: "Tus eventos, ordenados por la próxima fecha. Los anuales, como los cumpleaños, se renuevan solos. Tocá uno para verlo o editarlo.",
  },
  {
    id: "agregar",
    target: TOUR_TARGETS.add,
    title: "Agregá un evento",
    body: isWeb
      ? "Con el + cargás un cumpleaños, un aniversario, una cita o lo que necesites."
      : "Con el + cargás un cumpleaños, un aniversario, una cita o lo que necesites, y elegís con cuánta anticipación querés el aviso.",
  },
  {
    id: "tab-agenda",
    target: TOUR_TARGETS.tabAgenda,
    title: "Agenda",
    body: "Esta pantalla: lo próximo de un vistazo. Los eventos que ya pasaron se ocultan solos.",
  },
  {
    id: "tab-calendario",
    target: TOUR_TARGETS.tabCalendar,
    title: "Calendario",
    body: "Tus eventos por mes o por semana, también los que ya pasaron. Tocá un día para ver qué hay.",
  },
  {
    id: "tab-notas",
    target: TOUR_TARGETS.tabNotes,
    title: "Notas",
    body: "Apuntes rápidos que no son eventos: crealos, editalos y buscalos.",
  },
  {
    id: "tab-perfil",
    target: TOUR_TARGETS.tabProfile,
    title: "Perfil",
    body:
      `Tu nombre y foto, el tema claro u oscuro, los tipos de evento, importar cumpleaños de tus contactos${isWeb ? " (en la app instalada)" : ""}, ` +
      "exportar o restaurar una copia y cómo se cuidan tus datos." +
      (remindersAvailable
        ? " En «Avisos» activás las notificaciones si todavía no les diste permiso."
        : "") +
      " El botón ? vuelve a abrir este recorrido.",
  },
];
