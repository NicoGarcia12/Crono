/**
 * Versión WEB de guardar/elegir archivos (Metro la usa sola en el navegador).
 *
 * 💡 Aprendizaje: en el navegador no hay sandbox de archivos ni hoja de
 * Compartir: se descarga con un <a download> y se elige con un <input type=file>.
 */

/** Dispara la descarga del archivo en el navegador. */
export async function saveAndShare(fileName: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}

/** Abre el selector de archivos del navegador y devuelve el texto del elegido. */
export async function pickTextFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    // Sin esto, en algunos navegadores el input no dispara el evento al no estar en el DOM.
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) {
        resolve(null);
        return;
      }
      file.text().then(resolve).catch(() => resolve(null));
    });

    // Si el usuario cancela, el evento 'cancel' llega (navegadores modernos).
    input.addEventListener('cancel', () => {
      document.body.removeChild(input);
      resolve(null);
    });

    input.click();
  });
}
