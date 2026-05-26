import { NextRequest, NextResponse } from 'next/server';
import { getCatalogRows } from '@/lib/JatuneCatalog';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const normalizeType = (value?: string | null) => {
  if (!value || value === 'Todos') return null;
  const clean = value.trim().toUpperCase();
  if (clean === 'ALBUM' || clean === 'ÁLBUM') return 'Álbum';
  if (clean === 'EP') return 'EP';
  if (clean === 'SENCILLO' || clean === 'SINGLE') return 'Sencillo';
  return value;
};

const safeName = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9-_ .]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 120) || 'archivo';

const getExtension = (url: string, contentType?: string | null) => {
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.wav')) return 'wav';
  if (cleanUrl.endsWith('.mp3')) return 'mp3';
  if (cleanUrl.endsWith('.m4a')) return 'm4a';
  if (cleanUrl.endsWith('.aac')) return 'aac';
  if (contentType?.includes('wav')) return 'wav';
  if (contentType?.includes('mpeg')) return 'mp3';
  if (contentType?.includes('mp4')) return 'm4a';
  return 'audio';
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (buffer: Buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const dosDateTime = (date = new Date()) => {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const dosDate = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time, dosDate };
};

const buildZip = (files: Array<{ name: string; data: Buffer }>) => {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { time, dosDate } = dosDateTime();

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, 'utf-8');
    const data = file.data;
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + data.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(localData.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localData, centralDir, end]);
};

const buildRows = (albumId: number | null, tipoRaw: string | null) => {
  const tipo = normalizeType(tipoRaw);
  return getCatalogRows().filter((row) => {
    const byAlbum = albumId ? row.album_id === albumId : true;
    const byType = tipo ? row.tipo === tipo : true;
    return byAlbum && byType && Boolean(row.audio_url);
  });
};

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const albumId = body?.album_id ? Number(body.album_id) : null;
    const tipo = body?.tipo || null;
    const rows = buildRows(albumId, tipo);

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, code: 'NO_AUDIO_FOUND', message: 'No hay audios disponibles para descargar con ese filtro.' },
        { status: 404, headers: getCorsHeaders(request) }
      );
    }

    const files: Array<{ name: string; data: Buffer }> = [];
    const metadata: any[] = [];

    for (const [index, row] of rows.entries()) {
      const response = await fetch(row.audio_url as string);
      if (!response.ok) {
        metadata.push({ track_id: row.cancion_id, titulo: row.cancion, audio_url: row.audio_url, download_error: response.statusText });
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = getExtension(row.audio_url as string, response.headers.get('content-type'));
      const trackNumber = String(index + 1).padStart(2, '0');
      const fileName = `audio/${trackNumber} - ${safeName(row.artista)} - ${safeName(row.cancion)}.${ext}`;
      files.push({ name: fileName, data: buffer });

      metadata.push({
        track_number: index + 1,
        track_id: row.cancion_id,
        titulo: row.cancion,
        artista: row.artista,
        proyecto: row.album,
        tipo: row.tipo,
        clip_id: row.clip_id,
        duration: row.duration,
        source_format: ext,
        wav_requested: true,
        wav_note: ext === 'wav' ? 'Archivo WAV descargado.' : 'La API entregó este formato. Si necesitas WAV real, descárgalo desde Suno o habilitamos conversión con FFmpeg en una fase posterior.',
        audio_file: fileName,
        audio_url: row.audio_url,
        audio_final_status: row.audio_final_status,
        master_status: row.master_status,
        metadata_status: row.metadata_status,
        distribution_status: row.distribution_status,
        genero: row.genre,
        subgenero: row.subgenre,
        idioma: row.language,
        isrc: row.isrc,
        fecha_lanzamiento: row.release_date,
        creditos: row.credits,
        descripcion_corta: row.description_short,
        descripcion_larga: row.description_long,
      });
    }

    files.push({ name: 'metadata.json', data: Buffer.from(JSON.stringify({ exported_at: new Date().toISOString(), tracks: metadata }, null, 2), 'utf-8') });
    files.push({ name: 'README.txt', data: Buffer.from('JATune Production - paquete de audio + metadata\n\nEl sistema prioriza WAV si Suno lo expone por URL. Si los archivos vienen en otro formato, se incluyen en el ZIP sin conversión falsa.\n', 'utf-8') });

    const zip = buildZip(files);
    const projectName = rows[0]?.album ? safeName(rows[0].album) : 'jatune-package';

    return new NextResponse(zip, {
      status: 200,
      headers: {
        ...Object.fromEntries(getCorsHeaders(request).entries()),
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${projectName}-audio-metadata.zip"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, code: 'DOWNLOAD_AUDIO_PACKAGE_FAILED', message: error?.message || 'No fue posible descargar paquete de audio.' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
