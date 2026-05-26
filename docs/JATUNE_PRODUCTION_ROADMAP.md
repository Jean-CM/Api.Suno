# JATune Production — Roadmap de producción, catálogo y distribución

Este documento define la dirección operativa del sistema JATune Production después de validar que el motor puede generar música usando Suno desde Render.

## Decisión de arquitectura

JATune Production será el sistema maestro para:

- Catálogo musical.
- Artistas.
- Álbumes, EPs y sencillos.
- Workspaces internos.
- Historial de generación.
- Selección de versiones.
- Audio final aprobado.
- Portadas.
- Metadata.
- Descripciones.
- Prompts visuales.
- Checklist de distribución.

Suno se usará principalmente como:

- Motor de creación musical.
- Fuente de generación de versiones.
- Espacio de descarga del audio creado.

No dependeremos de Suno como centro principal de organización. Los álbumes, EPs, workspaces y seguimiento vivirán dentro del entorno JATune.

---

## Flujo maestro de producción

```text
1. Crear/importar catálogo en JATune.
2. Crear workspace lógico JATune por Álbum/EP/Sencillo.
3. Usar Suno para generar música.
4. Guardar solo la versión seleccionada en JATune.
5. Descargar/revisar audio.
6. Masterizar si aplica.
7. Crear portada.
8. Preparar metadata.
9. Preparar descripción y prompts visuales.
10. Completar checklist de distribución.
11. Subir a distribuidora.
12. Distribuir a plataformas.
```

---

## Fase de descarga y preparación final

Después de que una canción esté completada, JATune debe permitir controlar estas etapas:

### 1. Audio final

- Guardar `audio_url`.
- Guardar `clip_id`.
- Guardar duración si Suno la devuelve.
- Identificar versión seleccionada.
- Descargar o abrir audio desde JATune.
- Marcar como audio aprobado.

### 2. Revisión y master

Estados sugeridos:

```text
Completada
En revisión
Aprobada
Para master
Masterizada
Descartada
```

### 3. Portada

Campos sugeridos:

```text
cover_prompt
cover_url
cover_status
cover_notes
```

### 4. Metadata

Campos necesarios:

```text
Título
Artista
Álbum/EP/Sencillo
Género
Subgénero
Idioma
ISRC
Fecha de lanzamiento
Créditos
Explícita: sí/no
Notas internas
```

### 5. Descripción

Campos sugeridos:

```text
description_short
description_long
spotify_pitch
youtube_description
tiktok_caption
instagram_caption
```

### 6. Prompts visuales

Campos sugeridos:

```text
visual_prompt_cover
visual_prompt_canvas
visual_prompt_short_video
visual_prompt_lyric_video
```

### 7. Checklist de distribución

Checklist por canción/proyecto:

```text
Audio revisado
Audio masterizado
Portada lista
Metadata completa
ISRC asignado
Fecha de lanzamiento definida
Créditos revisados
Descripción lista
Canvas/visual preparado
Subido a distribuidora
Enviado a Spotify
Enviado a Apple Music
Enviado a YouTube Music
Enviado a TikTok
Publicado
```

Distribuidoras consideradas:

```text
DistroKid
TuneCore
CD Baby
Amuse
RouteNote
Otra
```

Plataformas objetivo:

```text
Spotify
Apple Music
YouTube Music
TikTok
Instagram/Facebook Music
Deezer
Amazon Music
Tidal
```

---

## Regla de selección automática de versiones Suno

Suno normalmente puede devolver dos versiones por generación.

La regla inicial de JATune será:

```text
Guardar solo una versión: la de menor duración disponible.
```

Objetivo:

- Reducir ruido en el catálogo.
- Evitar duplicados innecesarios.
- Mantener una pista principal por canción.
- Facilitar la producción por álbum completo.

Si la duración no está disponible, JATune usará este orden:

```text
1. Clip con menor duración detectada.
2. Clip que tenga audio_url.
3. Primer clip válido devuelto por Suno.
```

Fase futura:

- Permitir cambiar criterio desde el dashboard:
  - Menor duración.
  - Mayor duración.
  - Primera versión.
  - Selección manual.

---

## Flujo recomendado para álbumes y EPs

Para un álbum de 10 canciones:

```text
1. Importar las 10 canciones en JATune.
2. Crear workspace lógico del álbum.
3. Generar canción por canción.
4. Por cada canción, Suno puede devolver dos versiones.
5. JATune selecciona automáticamente una sola versión.
6. Guardar audio_url principal.
7. Revisar canción.
8. Marcar como aprobada o reintentar.
9. Al completar el álbum, preparar portada/metadata/checklist.
10. Exportar paquete de distribución.
```

---

## Principio operativo

JATune organiza. Suno genera.

```text
JATune = catálogo, control, producción, metadata y distribución.
Suno = creación musical y fuente de audio.
```

Esta separación evita depender de la estructura visual de Suno y permite que JATune escale como plataforma propia.
