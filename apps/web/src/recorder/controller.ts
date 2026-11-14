/**
 * Recorder state shared by the admin panel (settings, start buttons) and the
 * floating dock (REC indicator, countdown, intro stage, result). It lives in
 * this module so a screen recording keeps running while the admin moves
 * between the admin panel and the game.
 *
 * This module is only loaded (lazily) after the server has accepted the admin
 * token, so ordinary players never download or render any of it.
 */
import { useSyncExternalStore } from 'react';
import type { Appearance } from '@futbolchi/engine';
import type { IntroHandle } from '../intro/IntroPlayer';
import { introScript } from '../i18n/intro';
import { recTexts } from '../i18n/recorder';
import { canCaptureScreen, canRecord, captureTab, Compositor, DEFAULT_SETTINGS, mixAudio, pickMime, streamVideo, Take, type Recording, type RecSettings } from './media';

export type Phase = 'idle' | 'arming' | 'countdown' | 'recording' | 'paused' | 'finishing' | 'done';

export interface IntroJob {
  name: string;
  appearance: Appearance;
}

export interface RecState {
  phase: Phase;
  kind: 'intro' | 'screen' | null;
  countdown: number;
  elapsed: number;
  settings: RecSettings;
  /** Intro being recorded (the dock mounts its player). */
  intro: IntroJob | null;
  result: Recording | null;
  message: string | null;
  /** True when the REC indicator could show up in a screen recording. */
  overlayWarning: boolean;
}

const SETTINGS_KEY = 'futbolchi.recSettings';
const readSettings = (): RecSettings => {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<RecSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

let state: RecState = {
  phase: 'idle',
  kind: null,
  countdown: 0,
  elapsed: 0,
  settings: readSettings(),
  intro: null,
  result: null,
  message: null,
  overlayWarning: false,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<RecState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const useRecorder = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
export const getRecorder = () => state;

// ---------------------------------------------------------------- the running take
let take: Take | null = null;
let compositor: Compositor | null = null;
let cleanup: (() => void)[] = [];
let tick = 0;
let introHandle: IntroHandle | null = null;

const URL_TEXT = 'futbolchi-pro.vercel.app';

export function updateSettings(patch: Partial<RecSettings>) {
  const settings = { ...state.settings, ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* per-visit only */
  }
  set({ settings });
}

function fail(message: string) {
  teardown();
  set({ phase: 'idle', kind: null, intro: null, message });
}

function teardown() {
  clearInterval(tick);
  compositor?.stop();
  compositor = null;
  cleanup.forEach((f) => f());
  cleanup = [];
  take = null;
  introHandle = null;
}

async function countdown() {
  for (const n of [3, 2, 1]) {
    set({ phase: 'countdown', countdown: n });
    await new Promise((r) => setTimeout(r, 800));
  }
}

async function microphone(): Promise<MediaStream | null> {
  if (!state.settings.mic) return null;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    cleanup.push(() => s.getTracks().forEach((t) => t.stop()));
    return s;
  } catch {
    return null;
  }
}

/** Starts MediaRecorder on the compositor canvas plus the mixed sound. */
async function begin(sources: MediaStream[]) {
  const mime = pickMime()!;
  const video = compositor!.canvas.captureStream(state.settings.fps);
  const mic = await microphone();
  const mix = mixAudio([...(state.settings.audio ? sources : []), ...(mic ? [mic] : [])]);
  if (mix) cleanup.push(mix.close);
  const stream = new MediaStream([...video.getVideoTracks(), ...(mix ? mix.stream.getAudioTracks() : [])]);
  take = new Take(stream, mime, state.settings);
  take.start();
  set({ phase: 'recording', elapsed: 0 });
  tick = window.setInterval(() => take && set({ elapsed: take.elapsed() }), 250);
}

// ---------------------------------------------------------------- intro
/** Opens the intro stage in the dock; recording starts when the player is ready. */
let lastIntro: IntroJob | null = null;

export function recordIntro(job: IntroJob) {
  lastIntro = job;
  if (state.phase !== 'idle' && state.phase !== 'done') return;
  if (!canRecord()) return set({ message: recTexts().notSupported });
  releaseResult();
  set({ phase: 'arming', kind: 'intro', intro: job, message: null, overlayWarning: false });
}

/** Called by the dock's IntroPlayer once it has loaded. */
export async function introReady(h: IntroHandle) {
  introHandle = h;
  compositor = new Compositor(h.canvas, { settings: state.settings, playNow: introScript().playNow, url: URL_TEXT });
  compositor.start();
  await countdown();
  await begin([h.audio]);
  h.start();
}

/** Called by the dock when the film ends. */
export function introEnded() {
  void finish();
}

// ---------------------------------------------------------------- screen
export async function recordScreen() {
  if (state.phase !== 'idle' && state.phase !== 'done') return;
  if (!canRecord() || !canCaptureScreen()) return set({ message: recTexts().noScreen });
  releaseResult();
  set({ phase: 'arming', kind: 'screen', message: null });
  const target = document.querySelector('.app') ?? document.body;
  let cap: Awaited<ReturnType<typeof captureTab>>;
  try {
    cap = await captureTab(target, state.settings.fps, state.settings.audio);
  } catch {
    return fail(recTexts().cancelled);
  }
  cleanup.push(() => cap.stream.getTracks().forEach((t) => t.stop()));
  // the admin ended the share from Chrome's own bar
  cap.stream.getVideoTracks()[0].addEventListener('ended', () => {
    if (state.phase === 'recording' || state.phase === 'paused') void finish();
  });
  const video = await streamVideo(cap.stream);
  compositor = new Compositor(video, { settings: state.settings, playNow: introScript().playNow, url: URL_TEXT });
  compositor.start();
  set({ overlayWarning: !cap.overlayHidden });
  await countdown();
  await begin([cap.stream]);
}

// ---------------------------------------------------------------- controls
export function pause() {
  if (state.phase !== 'recording' || !take) return;
  take.pause();
  introHandle?.pause();
  set({ phase: 'paused' });
}

export function resume() {
  if (state.phase !== 'paused' || !take) return;
  take.resume();
  introHandle?.resume();
  set({ phase: 'recording' });
}

export async function finish() {
  if (!take || !compositor || state.phase === 'finishing') return;
  if (state.phase === 'paused') resume();
  set({ phase: 'finishing' });
  if (state.settings.endCard) await compositor.endCard();
  const result = await take.stop();
  teardown();
  set({ phase: 'done', result, intro: null });
}

/** Start/stop toggle for the keyboard shortcut. */
export function toggle() {
  if (state.phase === 'recording' || state.phase === 'paused') void finish();
  else if (state.phase === 'idle' || state.phase === 'done') void recordScreen();
}

function releaseResult() {
  if (state.result) URL.revokeObjectURL(state.result.url);
  set({ result: null });
}

export function closeResult() {
  releaseResult();
  set({ phase: 'idle', kind: null, message: null });
}

/** Records the same thing again (the same intro hero, or the screen). */
export function again() {
  const kind = state.kind;
  closeResult();
  if (kind === 'intro' && lastIntro) recordIntro(lastIntro);
  else void recordScreen();
}
