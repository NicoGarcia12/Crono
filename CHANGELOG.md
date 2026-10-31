# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Added

- **Recorrido de primer uso (CRONO44)**: después de la bienvenida, Agenda muestra una tarjeta inicial: arriba, **Antes de empezar** explica que los avisos dependen del permiso y del sistema (en web, que no hay avisos) y que los datos quedan en el dispositivo salvo lo que se exporte, se comparta o copie el backup del sistema; debajo pregunta "¿Querés un recorrido por la app?" con **No, gracias** y **Sí, mostrame**. La tarjeta queda guardada como vista apenas aparece: si se cierra o recarga la app sin responder, o a mitad del recorrido, no vuelve. Si se acepta, un recorrido guiado sobre Agenda oscurece la pantalla y resalta el buscador, los filtros por tipo y por etiqueta (si hay), la lista o su estado vacío, el botón **+** y cada pestaña (Agenda, Calendario, Notas, Perfil), con indicador "N de M" y botones Saltar, Anterior, Siguiente y Terminar (en el paso de Perfil, el último). Los pasos cuyo elemento no está en pantalla se omiten, y el recorrido aparece recién cuando están medidos (con un tope de tiempo), así el "N de M" no salta. No, gracias, Saltar o Terminar lo cierran; la tarjeta aparece una sola vez, también al actualizar, y Perfil suma un botón **?** para volver a ver el recorrido en Agenda, directo en el primer paso, sin la tarjeta y solo para esa sesión. Funciona en web y nativo, con safe areas, tema claro/oscuro y lectores de pantalla; en pantallas chicas el texto de la tarjeta se desplaza dentro del globo. En web, lo de abajo queda `inert`, Tab y Shift+Tab no sacan el foco de la tarjeta ni del recorrido, y Escape equivale a No, gracias o a Saltar.
- **Avisos en Perfil (CRONO44)**: nueva fila "Avisos" (solo donde hay recordatorios) que muestra si el permiso está activado, si todavía se puede pedir o si quedó bloqueado en el sistema. Si se puede pedir, muestra la misma explicación que la bienvenida y pide el permiso; si está bloqueado, abre los ajustes del celular. Se actualiza al volver a la pantalla o a la app. Así quienes actualizan o negaron el permiso pueden activar los avisos.

### Changed

- **Permiso de avisos (CRONO44)**: ya no se pide al abrir la app. Al tocar **Empezar** en la bienvenida, un aviso explica para qué sirven los recordatorios y que dependen del permiso del sistema, y recién después se pide el permiso; si se niega o falla, el nombre se guarda igual. Si guardar el nombre falla, se muestra el error y el reintento no repite la explicación ni el pedido. El canal Android "Recordatorios" se sigue creando en el arranque para no afectar los avisos existentes; si el sistema falla al crearlo, se registra y la app arranca igual. En web y Expo Go Android no hay aviso ni pedido.
- **Aviso al exportar (CRONO44)**: antes de abrir Compartir o descargar, Perfil pide confirmar que la copia va a ser accesible para cualquiera que la tenga y sugiere guardarla en un lugar privado. La tarjeta deja de sugerir Drive o WhatsApp y aclara que el archivo es legible, que no conviene mandarlo por chat y que no incluye fotos ni ideas de regalo.
- **Textos de privacidad (CRONO44)**: Perfil aclara que lo exportado o compartido sale del celular, que la copia de seguridad del sistema puede incluir los datos de la app y que Crono no debería ser el único aviso para algo importante. La bienvenida en web dice que los datos se guardan en este navegador.

### Fixed

- **Notas (CRONO42)**: crear y editar esperan la confirmación del guardado y bloquean envíos duplicados. Si falla, el formulario conserva el texto, muestra el error y permite reintentar. Borrar también espera la confirmación real, avisa si falla y no puede ejecutarse al mismo tiempo que guardar.
- **Bloqueo (CRONO40)**: se admite el PIN, patrón o contraseña del sistema sin exigir biometría, y sólo una verificación nativa exitosa habilita el acceso. Cancelaciones, fallos y errores mantienen la app cerrada; sin credencial se indica configurarla y reintentar. En web se advierte que no hay bloqueo local y se requiere continuar explícitamente. Se conserva la gracia de 2 minutos en segundo plano.
- **Versionado y previews (CRONO43)**: el corte de release sincroniza la versión de package, lock y Expo. Cada preview incrementa el número de build remoto de EAS sin contador local; se documentan identificación del artefacto y prueba de actualización sin desinstalar.
- **Permisos de fotos (CRONO50)**: el plugin de imágenes deja de solicitar micrófono y Android bloquea `RECORD_AUDIO` también al fusionar manifests de dependencias. Se conservan cámara y galería; el cambio requiere un binario nuevo.
- **Limpieza de fotos (CRONO51)**: elegir o cancelar una foto no copia nada. La foto se copia (con `await` real: en SDK 57 `File.copy` es asíncrono) dentro de la transacción al guardar un evento o la foto de perfil. Reemplazar o quitar una foto, borrar un evento o borrar un tipo con sus eventos eliminan, tras el commit, sólo las copias propias de `/photos` sin referencia en SQLite (eventos y perfil); las compartidas, los originales de galería y los archivos ajenos no se tocan. Si la copia falla se conserva la foto anterior y se limpia la copia parcial; si el borrado falla, el guardado vale, se avisa y se reintenta al abrir la app o al guardar otra foto.
- **Ayuda por plataforma (CRONO52)**: perfil, recordatorios y contactos explican las capacidades reales de web, Expo Go y app instalada. Web informa que no hay bloqueo local, avisos ni importación de contactos, y explica descarga/restauración de backups sin prometer sincronización entre dispositivos.

## [1.0.0] - 2026-10-18

Primera versión de Crono: una agenda personal para el celular, sin servidor ni cuenta, con los datos guardados solo en el dispositivo. Funciona en Android, iOS y web.

### Added

- **Agenda**: lista de eventos próximos ordenados por fecha (los pasados se ocultan), con título, fecha, hora opcional, descripción, tipo, etiquetas y foto. Los eventos anuales se repiten solos cada año.
- **Cuenta regresiva** en el detalle de cada evento.
- **Buscador** de eventos y notas.
- **Etiquetas** propias para clasificar y filtrar los eventos.
- **Calendario** con vista mensual y semanal, navegable, que muestra los cumpleaños y aniversarios del mes.
- **Tipos de evento**: 5 de fábrica (Evento, Cumpleaños, Aniversario, Día festivo, Cita médica) y tipos propios con nombre, ícono y color editables.
- **Funciones por tipo**: edad, años transcurridos, "¿ya lo saludé?", saludo por WhatsApp e ideas de regalo, combinables en cualquier tipo.
- **Campos extra por tipo** (texto, número, una opción o varias), opcionalmente obligatorios, hasta 15 por tipo. Al borrar un tipo, sus eventos se mueven a otro.
- **Recordatorios**: varios avisos por evento, con atajos (en el momento, 1 hora, 1 día, 1 semana antes) o a medida, y notificaciones con el emoji del tipo y el tiempo relativo ("Es mañana").
- **Importar cumpleaños desde los contactos** del celular, solo los que tienen teléfono y son de tu cuenta de Google o iCloud, con nombre editable antes de guardar.
- **Saludar por WhatsApp** desde cumpleaños y aniversarios.
- **Ideas de regalo** por persona.
- **Mi cumpleaños** en el perfil: qué edad cumplís y la lista "¿Quién me saludó?", que se renueva cada año.
- **Perfil** con nombre y foto del usuario.
- **Notas** rápidas.
- **Copia de seguridad**: exportar y restaurar eventos, notas, tipos de evento y saludos en un archivo.
- **Bloqueo** con la huella, la cara o el PIN del celular, que se vuelve a activar tras 2 minutos en segundo plano.
- **Modo oscuro**: automático, claro u oscuro.
- **Identidad visual de Crono**: isotipo, logotipo, paleta de colores, íconos de la app y diálogos propios con los estilos de la app.
