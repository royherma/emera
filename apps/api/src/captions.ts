import type { Env } from './env';
import type { MediaRow } from './serialize';
import { readVideoInfo } from './videoInfo';

const MODEL = '@cf/openai/whisper-large-v3-turbo';
// Media Transformations cuts at most 60 s of audio per call and reads at most 10 minutes of input.
const CHUNK_SECONDS = 60;
const MAX_INPUT = 100 * 1024 * 1024;
const CUE_WORDS = 7;
const CUE_SECONDS = 3.5;
const NO_SPEECH = 0.6;

export const captionsKey = (id: string) => `${id}-captions.vtt`;

type Word = { word: string; start: number; end: number };
type Segment = { start: number; end: number; text: string; no_speech_prob?: number; words?: Word[] };
export type Cue = { start: number; end: number; text: string };

const stamp = (s: number) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
};

export function toVtt(cues: Cue[]): string {
  return `WEBVTT\n\n${cues.map((c) => `${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}`).join('\n\n')}\n`;
}

export function cuesFrom(segments: Segment[], offset: number): Cue[] {
  const cues: Cue[] = [];
  for (const s of segments) {
    if ((s.no_speech_prob ?? 0) >= NO_SPEECH || !s.text.trim()) continue;
    const words = s.words?.filter((w) => w.word.trim());
    if (!words?.length) {
      cues.push({ start: offset + s.start, end: offset + s.end, text: s.text.trim() });
      continue;
    }
    let group: Word[] = [];
    const flush = () => {
      if (!group.length) return;
      cues.push({ start: offset + group[0].start, end: offset + group[group.length - 1].end, text: group.map((w) => w.word.trim()).join(' ') });
      group = [];
    };
    for (const w of words) {
      if (group.length >= CUE_WORDS || (group.length && w.end - group[0].start > CUE_SECONDS)) flush();
      group.push(w);
      if (/[.!?]$/.test(w.word.trim())) flush();
    }
    flush();
  }
  return cues;
}

function base64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function audioAt(env: Env, key: string, at: number, seconds: number): Promise<Uint8Array | null> {
  const src = await env.MEDIA.get(key);
  if (!src) return null;
  const res = await env.VIDEO!.input(src.body)
    .output({ mode: 'audio', time: `${at}s`, duration: `${seconds}s` })
    .response();
  if (!res.ok) throw new Error(`audio ${res.status}`);
  const out = new Uint8Array(await res.arrayBuffer());
  return out.length ? out : null;
}

export async function makeCaptions(env: Env, mediaId: string): Promise<'done' | 'skipped'> {
  const row = await env.DB.prepare(`SELECT * FROM media WHERE id = ? AND kind = 'video' AND status = 'done'`).bind(mediaId).first<MediaRow & { bytes: number }>();
  if (!row || row.captions_key || !env.VIDEO || !env.AI || row.bytes >= MAX_INPUT) return 'skipped';
  const info = await readVideoInfo(env.MEDIA, row.r2_key, row.bytes).catch(() => null);
  const length = info?.seconds || CHUNK_SECONDS;

  const cues: Cue[] = [];
  for (let at = 0; length - at >= 1; at += CHUNK_SECONDS) {
    const audio = await audioAt(env, row.r2_key, at, Math.min(CHUNK_SECONDS, Math.floor(length - at)));
    if (!audio) break;
    const out = (await env.AI.run(MODEL, { audio: base64(audio), vad_filter: true })) as { segments?: Segment[] };
    cues.push(...cuesFrom(out.segments ?? [], at));
  }
  if (!cues.length) return 'skipped';

  const key = captionsKey(row.id);
  await env.MEDIA.put(key, toVtt(cues), { httpMetadata: { contentType: 'text/vtt; charset=utf-8' } });
  await env.DB.prepare('UPDATE media SET captions_key = ? WHERE id = ? AND captions_key IS NULL').bind(key, row.id).run();
  return 'done';
}
