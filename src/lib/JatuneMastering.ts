import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { safeFileName } from './JatuneZip';

export type MasterPresetKey = 'streaming_ready' | 'urbano_punchy' | 'pop_romantico' | 'kids_bright' | 'cristiano_calido';

export type MasterPreset = {
  key: MasterPresetKey;
  name: string;
  description: string;
  loudnessTarget: string;
  truePeak: string;
  bitrate: string;
  filter: string;
};

export const MASTER_PRESETS: Record<MasterPresetKey, MasterPreset> = {
  streaming_ready: {
    key: 'streaming_ready',
    name: 'Streaming Ready',
    description: 'Normalización limpia para Spotify, YouTube Music, TikTok y distribución general.',
    loudnessTarget: '-14 LUFS',
    truePeak: '-1.5 dB',
    bitrate: '320k',
    filter: 'loudnorm=I=-14:TP=-1.5:LRA=11,acompressor=threshold=-18dB:ratio=2:attack=20:release=250,alimiter=limit=0.95',
  },
  urbano_punchy: {
    key: 'urbano_punchy',
    name: 'Urbano Punchy',
    description: 'Más pegada para dembow, reggaetón, trap latino y beats con bajo dominante.',
    loudnessTarget: '-13 LUFS',
    truePeak: '-1.3 dB',
    bitrate: '320k',
    filter: 'loudnorm=I=-13:TP=-1.3:LRA=9,acompressor=threshold=-20dB:ratio=2.6:attack=12:release=180,alimiter=limit=0.96',
  },
  pop_romantico: {
    key: 'pop_romantico',
    name: 'Pop Romántico',
    description: 'Balance suave, cálido y presente para canciones melódicas y voces íntimas.',
    loudnessTarget: '-14 LUFS',
    truePeak: '-1.5 dB',
    bitrate: '320k',
    filter: 'loudnorm=I=-14:TP=-1.5:LRA=12,acompressor=threshold=-19dB:ratio=1.8:attack=25:release=300,alimiter=limit=0.95',
  },
  kids_bright: {
    key: 'kids_bright',
    name: 'Kids Bright',
    description: 'Sonido claro y brillante para contenido infantil, educativo y alegre.',
    loudnessTarget: '-14 LUFS',
    truePeak: '-1.5 dB',
    bitrate: '320k',
    filter: 'loudnorm=I=-14:TP=-1.5:LRA=10,acompressor=threshold=-18dB:ratio=2:attack=18:release=220,alimiter=limit=0.95',
  },
  cristiano_calido: {
    key: 'cristiano_calido',
    name: 'Cristiano Cálido',
    description: 'Master cálido y controlado para worship, pop cristiano y baladas espirituales.',
    loudnessTarget: '-14 LUFS',
    truePeak: '-1.5 dB',
    bitrate: '320k',
    filter: 'loudnorm=I=-14:TP=-1.5:LRA=13,acompressor=threshold=-20dB:ratio=1.7:attack=30:release=320,alimiter=limit=0.95',
  },
};

export const getMasterPreset = (raw?: string | null): MasterPreset => {
  const key = String(raw || 'streaming_ready') as MasterPresetKey;
  return MASTER_PRESETS[key] || MASTER_PRESETS.streaming_ready;
};

const run = (command: string, args: string[], timeoutMs = 180000) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Timeout ejecutando ${command} después de ${Math.round(timeoutMs / 1000)} segundos.`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || `${command} terminó con código ${code}`));
    });
  });

const workspaceRoot = () => path.join(os.tmpdir(), 'jatune-mastering');

const ensureWorkspace = async () => {
  const dir = path.join(workspaceRoot(), randomUUID());
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

export const fetchAudioToBuffer = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo descargar audio origen: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};

export const masterAudioBuffer = async (input: Buffer, options?: { title?: string; preset?: string | null }) => {
  const preset = getMasterPreset(options?.preset);
  const dir = await ensureWorkspace();
  const baseName = safeFileName(options?.title || 'jatune-master');
  const inputPath = path.join(dir, `${baseName}-source.mp3`);
  const outputPath = path.join(dir, `${baseName}-mastered.mp3`);

  try {
    await fs.writeFile(inputPath, input);
    await run('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', inputPath,
      '-af', preset.filter,
      '-codec:a', 'libmp3lame',
      '-b:a', preset.bitrate,
      '-ar', '44100',
      outputPath,
    ]);

    const output = await fs.readFile(outputPath);
    return { output, preset };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

export const masterAudioFromUrl = async (url: string, options?: { title?: string; preset?: string | null }) => {
  const input = await fetchAudioToBuffer(url);
  return masterAudioBuffer(input, options);
};
