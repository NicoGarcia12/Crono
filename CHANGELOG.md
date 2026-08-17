# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).
## [1.0.0] - 2026-08-17

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


### Merge

- Actualizar base calendario

- Actualizar base saludar whatsapp

- Actualizar base backup restaurar

- Integrar carga de cumpleaños con modo oscuro

- Propagar arreglos del calendario a la cadena

- Actualizar PR 12 con PR 11

- Propagar .gitignore de .playwright-mcp a la cadena

- Propagar .gitignore de .playwright-mcp a la cadena

- Propagar .gitignore de .playwright-mcp a la cadena


