# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
