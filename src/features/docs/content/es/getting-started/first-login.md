---
title: Primer inicio de sesión
description: Cómo iniciar sesión en Mkety, elegir una organización y orientarte en tu primera visita.
section: getting-started
order: 2
---

# Primer inicio de sesión

Mkety controla el límite de autenticación y sesión de la aplicación. Tu organización puede usar distintos métodos de inicio de sesión mediante un proveedor de identidad externo; ZITADEL es el adaptador inicial de la Plataforma.

## Iniciar sesión

1. Abrí la URL de Mkety Platform.
2. Seleccioná **Iniciar sesión**.
3. Completá el método de autenticación ofrecido por el proveedor configurado para tu organización.
4. Completá MFA u otras verificaciones cuando correspondan.
5. Después de validar el callback del proveedor, Mkety crea su propia sesión de aplicación y te redirige a la Plataforma.

Los tokens del proveedor no son sesiones de la aplicación Mkety. El acceso a cada organización se resuelve usando la membresía actual guardada por Mkety.

Si falta la opción de acceso esperada o el proveedor rechaza la solicitud, contactá a tu administrador de Mkety o al equipo de IT de tu organización.

## Selección de organización

Si tu membresía actual te da acceso a más de una organización, Mkety muestra la pantalla de selección después del inicio de sesión.

- Elegí la organización en la que querés trabajar.
- Si tenés una sola membresía vigente, Mkety puede dirigirte directamente a ella.
- Si una membresía fue eliminada, datos antiguos de roles guardados en una sesión no conceden acceso; la base de datos actual es la autoridad.

## Primera experiencia en el dashboard

Después de autenticarte y elegir una organización, las superficies disponibles dependen de tus permisos y membresía actuales. Podés ver workspaces de proyecto, administración, perfil/configuración, capacidades de IA y Automatización u otras áreas habilitadas.

Algunas áreas pueden estar deshabilitadas o reservadas para Enterprise. La visibilidad en la interfaz no reemplaza la autorización del backend.

## Primeros pasos útiles

1. Completá tu perfil y preferencias.
2. Confirmá que estás trabajando en la organización correcta.
3. Explorá el hub de workspaces y las capacidades disponibles para tu rol.
4. Consultá la documentación del área que estés configurando.
5. Cerrá sesión cuando uses un dispositivo compartido.

## Seguridad y sesiones

- **Sesión controlada por Mkety** — Después de autenticarte con el proveedor, Mkety emite su propia sesión opaca; solo su hash se guarda en el servidor.
- **Autorización actual** — Roles y permisos se resuelven desde los datos actuales de membresía/permisos de Mkety, no desde claims del proveedor ni cachés antiguos de sesión.
- **Contraseña y MFA** — La recuperación de credenciales y configuración de MFA dependen del proveedor de identidad configurado o del administrador SSO de tu organización.
- **Cerrar sesión** — Mkety revoca la sesión del servidor y elimina la cookie de aplicación. El cierre de sesión a nivel del proveedor depende del adaptador configurado.
- **Expiración** — Las sesiones Mkety expiradas o revocadas fallan de forma cerrada y requieren una nueva autenticación.

Para la arquitectura oficial, consultá `docs/MKETY_AUTH_SOURCE_OF_TRUTH.md`.
