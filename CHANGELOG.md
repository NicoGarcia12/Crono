# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).
## [1.0.0] - 2026-10-18

### Added

- Agenda personal con eventos, notas, bloqueo biometrico y recordatorios

- Infraestructura de testing (Jest + Playwright) y soporte web

- Build de APK con EAS (perfil preview)

- Importar cumpleanos desde los contactos del celular

- Recordatorios multiples por evento

- Recordatorios personalizados (numero + unidad)

- Recordatorios personalizados (numero + unidad)

- Rediseno de Cargar cumpleanos de contactos

- Pestana Calendario (mensual y semanal, navegable)

- Boton Saludar por WhatsApp en cumpleanos y aniversarios

- Copia de seguridad (exportar y restaurar)

- Buscador de eventos y notas + cuenta regresiva en el detalle

- Modo oscuro (automatico, claro u oscuro)

- Mi cumpleanos (quien me saludo) y edad que cumple este anio

- Mover mi cumpleanos al perfil

- Ideas de regalo por persona

- Avisar cuando los recordatorios no están disponibles (Expo Go)

- Notificaciones más humanas (emoji + tiempo relativo)

- Cumpleaños y aniversarios del mes en el calendario

- Categorías/etiquetas de eventos para filtrar

- Foto de perfil en eventos y del usuario

- Tipos de evento personalizables

- Identidad visual — isotipo, logotipo y paleta de colores

- Aplicar identidad visual #168BFF a toda la app

- Ícono iOS vía ios.icon (PNG) + logo Crono en pantallas de marca

- Comando /probar-en-dispositivo para probar builds preview en celular

- Script build:apk para generar un APK compartible vía EAS

- Nombre editable al importar cumpleaños de contactos

- Listar solo contactos de la cuenta de Google (Android) e iCloud/Google (iOS)

- Mostrar solo contactos con número de teléfono

- Modelo de bases y campos para tipos de evento componibles

- La lógica de cada evento depende de las capacidades de su tipo

- Editor de tipos y bases con campos extra y límite de 15

- Borrar tipos moviendo sus eventos y backup de tipos y campos

- Cargar datos nuevos uno por uno y mi cumpleaños con tipo propio

- Al editar un evento no se puede cambiar su tipo

- Campos obligatorios por campo, funciones incompatibles ocultas y errores visibles al guardar

- Diálogos propios con los estilos de Crono en lugar de Alert.alert y confirm/alert del navegador


### Fixed

- Cargar expo-notifications de forma diferida y omitirlo en Expo Go Android

- Endurecer importación de cumpleaños

- Make database migration retryable

- Compensate notification scheduling failures

- Preserve alerts during safe edits

- Make birthday import atomic

- Make database migration retryable

- Compensate notification scheduling failures

- Preserve alerts during safe edits

- Hacer atomica la importacion de cumpleanos

- Ocurrencia del 29/02, accesibilidad y virtualizacion

- La cuenta regresiva se prueba con una fecha futura relativa

- Cerrar bloqueos y quality gate

- Evitar doble apertura concurrente de la base

- Initial_tag en cliff.toml para que el primer bump matchee tag_pattern

- Pasar GITHUB_TOKEN a git-cliff para que pueda leer metadata de PRs en repos privados

- Compensar recordatorios si falla guardar un evento

- Usar Expo Go local en vez de build EAS en /probar-en-dispositivo

- Periodo de gracia antes de re-bloquear Crono

- Extender período de gracia del bloqueo a 2 minutos

- Transformar standard-navigation en Jest

- Migrar importación de contactos a la API nueva de expo-contacts

- Mostrar el error real al fallar la lectura de contactos

- Leer el cumpleaños de contactos en Android desde dates

- Ocultar eventos pasados de la agenda

- Un evento anual sin hora que cae hoy figura hoy, no el año que viene

- Concordancia de número en el panel de borrar tipo

- El campo de hora arranca vacío y el picker usa la API nueva

- Mostrar el error real al fallar la restauración del backup

- Leer el backup con el selector de expo-file-system para evitar el error de permiso READ en Android


