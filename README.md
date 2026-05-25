# JATune Production — Centro de Control Musical

Backend y dashboard operativo para gestionar generación musical asistida por Suno desde Render. Este repositorio parte de `suno-api` y fue adaptado para el flujo de trabajo de **JATune Production**: monitoreo de créditos, catálogo musical, carga masiva, workspaces lógicos por álbum/EP/sencillo y generación desde canciones pendientes.

> Estado actual: MVP funcional en Render. El backend ya valida créditos con `/api/get_limit` y el dashboard principal vive en `/`.

---

## Visión del proyecto

JATune Production busca funcionar como una mini disquera automatizada:

```text
Idea musical → Catálogo → Workspace → Track pendiente → Generación → Historial → Audio final
```

La arquitectura del catálogo se organiza así:

```text
Artista
└── Álbum / EP / Sencillo
    └── Canción / Track
```

Cada álbum, EP o sencillo también genera un **workspace lógico tipo Suno** para mantener control visual y operativo por proyecto.

---

## URL de producción

```text
https://api-suno-nptk.onrender.com
```

Rutas principales:

```text
/                         Dashboard JATune Production
/api/get_limit             Prueba de créditos de Suno
/api/generate              Generación musical por prompt
/api/catalog/summary       Resumen del catálogo
/api/catalog/tracks        Tracks del catálogo
/api/catalog/workspaces    Workspaces lógicos
/api/catalog/import        Importación masiva de catálogo
/api/catalog/generate-pending  Generar siguiente canción pendiente
```

---

## Funcionalidades JATune

### Dashboard principal

El dashboard en `/` muestra:

- Estado operativo del backend.
- Estado de cookie Suno.
- Créditos disponibles.
- Uso mensual.
- Límite mensual.
- Porcentaje de consumo.
- Tarjetas de catálogo.
- Carga masiva estructurada.
- Workspaces tipo Suno.
- Generación desde pendientes.
- Catálogo musical filtrable.

### Catálogo musical

Campos principales:

```text
Artista
Álbum / EP / Sencillo
Tipo
Canción
Prompt musical
Estado
Audio URL
Clip ID
Workspace lógico
```

Estados de canción:

```text
Pendiente
Generando
Completada
Error
Reintentar
Descartada
Publicada
Distribuida
```

Estados de workspace:

```text
Pendiente
Creado
Error
Sincronizar
```

### Workspaces tipo Suno

Al importar una carga masiva, el sistema crea un workspace lógico por proyecto.

Ejemplo:

```text
Zyphorix | Galactic Vibe | EP | Nebula Dance | Dembow Dominicano, Bajo Pesado, 120 BPM
Zyphorix | Galactic Vibe | EP | Solar Flare | Spatial Trap, Sintetizadores Futuristas
```

Crea el workspace lógico:

```text
Galactic Vibe · Zyphorix · EP
```

Y dentro quedan los tracks:

```text
Nebula Dance
Solar Flare
```

> Próxima fase: sincronizar esos workspaces lógicos con los workspaces reales dentro de Suno mediante Playwright o endpoint interno autorizado/estable.

---

## Despliegue en Render

### Tipo de servicio

Usar:

```text
Web Service
Runtime: Docker
Branch: main
Dockerfile Path: Dockerfile
```

El Dockerfile está preparado para:

- Next.js.
- Playwright.
- Chromium.
- Render `PORT=10000`.
- Bind a `0.0.0.0`.
- Evitar exponer `SUNO_COOKIE` durante build.

### Variables de entorno recomendadas

Configurar en Render → Environment:

```env
NODE_ENV=production
PORT=10000
SUNO_COOKIE=pega_aqui_tu_cookie_actual_de_suno
BROWSER=chromium
BROWSER_GHOST_CURSOR=false
BROWSER_HEADLESS=true
BROWSER_LOCALE=en
BROWSER_DISABLE_GPU=true
JATUNE_API_KEY=crea_una_clave_privada_larga
ALLOWED_ORIGIN=*
JATUNE_DATA_DIR=/data
```

Notas:

- `SUNO_COOKIE` debe ser una cookie vigente de Suno.
- `JATUNE_API_KEY` protege acciones sensibles del dashboard, como importar catálogo y generar pendientes.
- `ALLOWED_ORIGIN=*` sirve para pruebas. En producción se puede limitar al dominio del frontend.
- `JATUNE_DATA_DIR=/data` requiere disco persistente en Render.

### Disco persistente recomendado

Para no perder el catálogo en redeploys, agregar un disco en Render:

```text
Name: jatune-data
Mount Path: /data
Size: 1 GB
```

Luego mantener:

```env
JATUNE_DATA_DIR=/data
```

El sistema guardará:

```text
/data/catalog.json
```

Sin disco persistente, el sistema usa `.jatune-data`, pero puede perderse en redeploys. Eso sirve para pruebas, no para operación seria.

---

## Seguridad operativa

### API Key JATune

Si `JATUNE_API_KEY` está configurada en Render, las rutas protegidas requieren el header:

```http
x-api-key: TU_CLAVE
```

En el dashboard hay un campo llamado **Clave operativa del dashboard**. Ahí se pega la misma clave definida en Render.

Rutas protegidas:

```text
POST /api/catalog/import
POST /api/catalog/generate-pending
```

Recomendación:

- No compartir `JATUNE_API_KEY` en capturas.
- No subir `.env` al repositorio.
- Rotar `SUNO_COOKIE` si aparece en logs o capturas.

---

## Formato de carga masiva

El formato esperado usa `|` como separador:

```text
Artista | Álbum/EP/Sencillo | Tipo | Canción | Prompt musical
```

Tipos válidos:

```text
Sencillo
EP
Álbum
Album
Single
```

Ejemplo:

```text
Zyphorix | Galactic Vibe | EP | Nebula Dance | Dembow Dominicano, Bajo Pesado, 120 BPM
Zyphorix | Galactic Vibe | EP | Solar Flare | Spatial Trap, Sintetizadores Futuristas
Velnora | Sentimiento Puro | Sencillo | Sabor Calle | Bachata Urbana, Guitarra Afilada
Jeantune | Amor Digital | Álbum | Besos en la Nube | Pop Urbano Romántico, Synth Latino, 95 BPM
```

Después de importar:

1. Se crean artistas si no existen.
2. Se crean álbumes/EPs/sencillos.
3. Se crean canciones en estado `Pendiente`.
4. Se crean workspaces lógicos por proyecto.
5. El panel permite generar una canción pendiente por ejecución.

---

## Endpoints JATune

### GET `/api/catalog/summary`

Devuelve resumen ejecutivo del catálogo.

Respuesta ejemplo:

```json
{
  "ok": true,
  "summary": {
    "artistas": 2,
    "albumes": 3,
    "workspaces": 3,
    "canciones": 10,
    "pendientes": 8,
    "generando": 1,
    "completadas": 1,
    "errores": 0
  }
}
```

### GET `/api/catalog/tracks`

Devuelve las canciones registradas.

Filtros opcionales:

```text
/api/catalog/tracks?status=Pendiente
/api/catalog/tracks?artist=Jeantune
```

### GET `/api/catalog/workspaces`

Devuelve los workspaces lógicos creados desde el catálogo.

Filtro opcional:

```text
/api/catalog/workspaces?status=Pendiente
```

### POST `/api/catalog/import`

Importa catálogo masivo.

Header:

```http
x-api-key: TU_JATUNE_API_KEY
```

Body:

```json
{
  "text": "Jeantune | Amor Digital | Álbum | Besos en la Nube | Pop Urbano Romántico, Synth Latino, 95 BPM"
}
```

Respuesta ejemplo:

```json
{
  "ok": true,
  "summary": {
    "artistas_procesados": 1,
    "albumes_procesados": 1,
    "workspaces_planificados": 1,
    "canciones_creadas": 1,
    "canciones_actualizadas": 0
  },
  "imported": 1
}
```

### POST `/api/catalog/generate-pending`

Genera canciones pendientes desde el catálogo.

Header:

```http
x-api-key: TU_JATUNE_API_KEY
```

Body recomendado:

```json
{
  "limit": 1,
  "wait_audio": false,
  "make_instrumental": false
}
```

Por estabilidad se recomienda procesar una canción por ejecución. Playwright + Suno + Render no son una licuadora industrial; mejor producción controlada que incendio bonito.

---

## Endpoints heredados de Suno API

Este repo conserva las rutas base del proyecto original:

```text
POST /api/generate
POST /api/custom_generate
POST /api/generate_lyrics
GET  /api/get
GET  /api/get_limit
POST /api/extend_audio
POST /api/generate_stems
GET  /api/get_aligned_lyrics
GET  /api/clip
POST /api/concat
POST /v1/chat/completions
```

Prueba rápida:

```bash
curl "https://api-suno-nptk.onrender.com/api/get_limit"
```

Generación simple:

```bash
curl -X POST "https://api-suno-nptk.onrender.com/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"romantic latin pop, warm guitars, modern beat","make_instrumental":false,"wait_audio":false}'
```

---

## Troubleshooting

### Error: `Missing or invalid API key`

Causa:

- `JATUNE_API_KEY` está configurada en Render.
- El dashboard o la petición no envió el header `x-api-key`.

Solución:

1. Copiar la clave desde Render → Environment → `JATUNE_API_KEY`.
2. Pegarla en el dashboard en **Clave operativa del dashboard**.
3. Marcar “Recordar en este navegador” si se desea.
4. Reintentar importación o generación.

### Error de build TypeScript con `x-api-key`

Si aparece un error relacionado con:

```text
Property 'x-api-key' is incompatible with index signature
```

Actualizar a un commit donde `JatuneControlPanel.tsx` use `Headers()` en vez de objeto literal condicional. El fix correcto usa:

```ts
const headers = new Headers();
headers.set('Content-Type', 'application/json');
if (cleanKey) headers.set('x-api-key', cleanKey);
```

### Render descarga Playwright/Chromium y parece lento

Normal. Durante build puede aparecer:

```text
Downloading Chrome Headless Shell
Downloading FFmpeg
```

Eso no es error. El error real aparece cuando Render dice:

```text
Failed to compile
exit code 1
```

### Cookie expirada

Síntomas:

- `/api/get_limit` falla.
- Dashboard muestra cookie en validar.
- Suno no responde correctamente.

Solución:

1. Iniciar sesión en Suno.
2. Copiar una cookie nueva.
3. Actualizar `SUNO_COOKIE` en Render.
4. Ejecutar redeploy.

### El catálogo se pierde después de redeploy

Causa:

- No hay disco persistente.

Solución:

- Crear disco en Render con mount `/data`.
- Configurar `JATUNE_DATA_DIR=/data`.

---

## Flujo recomendado de operación

1. Validar créditos en `/api/get_limit`.
2. Abrir dashboard `/`.
3. Pegar `JATUNE_API_KEY` si está configurada.
4. Importar catálogo masivo.
5. Revisar workspaces lógicos.
6. Generar una canción pendiente.
7. Refrescar catálogo.
8. Auditar estado y audio generado.

---

## Roadmap

### Fase 1 — MVP en Render

- Dashboard operativo.
- Créditos Suno.
- Catálogo JSON persistible.
- Carga masiva.
- Workspaces lógicos.
- Generación desde pendientes.

### Fase 2 — Control avanzado

- Edición de tracks desde dashboard.
- Reintento automático de errores.
- Actualización de canciones en estado `Generando`.
- Descarga/exportación de catálogo.
- Filtros avanzados por artista/workspace/estado.

### Fase 3 — Sincronización con Suno

- Botón “Sincronizar workspace con Suno”.
- Captura de `suno_workspace_id`.
- Asociación de tracks generados con workspace real.

### Fase 4 — Base de datos formal

- Migración de JSON a PostgreSQL.
- Tabla de jobs.
- Tabla de logs.
- Historial completo de generaciones.
- Auditoría por fecha, artista y proyecto.

### Fase 5 — Worker / cola

- Generación por lotes controlados.
- Cola de trabajos.
- Procesamiento en background.
- Alertas por error.

---

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir:

```text
http://localhost:3000
```

Build local:

```bash
npm run build
npm run start
```

---

## Notas importantes

Este proyecto usa automatización de navegador y sesión de usuario para interactuar con Suno. Debe usarse de manera responsable, respetando términos aplicables, límites de uso y seguridad de credenciales.

No subir cookies ni claves al repositorio. Las credenciales van en Render Environment Variables.

---

## Licencia y origen

Este repositorio deriva de `gcui-art/suno-api`, proyecto no oficial y open source. La adaptación actual agrega la capa operativa de **JATune Production** para gestión musical, dashboard y catálogo.

Ver `LICENSE` para detalles de licencia.
