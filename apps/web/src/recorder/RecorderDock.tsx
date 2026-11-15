/**
 * The recorder's floating layer (admin only): the 3-2-1 countdown, the small
 * REC indicator with pause/stop, the clean intro stage while the intro is being
 * recorded, and the preview/download sheet afterwards. Keyboard shortcuts:
 * Alt+Shift+R start/stop a screen recording, Alt+Shift+P pause/resume.
 *
 * It renders into document.body (outside the captured .app element), so the
 * indicator is left out of screen recordings where the browser supports it.
 */
import { useEffect } from 'react';
import { PitchReplay } from '../replay/PitchReplay';
import { loadGame } from '../state/store';
import { createPortal } from 'react-dom';
import { recTexts } from '../i18n/recorder';
import { IntroPlayer } from '../intro/IntroPlayer';
import { again, closeResult, finish, getRecorder, introEnded, introReady, matchCanvas, pause, recordIntro, replayFinished, replayMounted, resume, toggle, useRecorder } from './controller';
import { canShareFiles, fileName, shareVideo, videoSize } from './media';

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function RecorderDock() {
  const st = useRecorder();
  const t = recTexts();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || !e.shiftKey) return;
      if (e.code === 'KeyR') {
        e.preventDefault();
        toggle();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        const p = getRecorder().phase;
        if (p === 'recording') pause();
        else if (p === 'paused') resume();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const size = videoSize(st.settings.aspect, st.settings.quality);
  // the replay stage: start recording as soon as its pitch canvas is on screen
  const replayId = st.replay?.matchId ?? null;
  useEffect(() => {
    if (!replayId) return;
    let raf = 0;
    const look = () => {
      const c = matchCanvas();
      if (c && c.width > 0) void replayMounted(c);
      else raf = requestAnimationFrame(look);
    };
    raf = requestAnimationFrame(look);
    return () => cancelAnimationFrame(raf);
  }, [replayId]);
  const game = replayId ? loadGame() : null;
  const replayMatch = replayId && game ? game.matches[replayId] : null;
  const live = st.phase === 'recording' || st.phase === 'paused' || st.phase === 'finishing';
  const r = st.result;

  return createPortal(
    <>
      {st.kind === 'intro' && st.intro && st.phase !== 'done' && st.phase !== 'idle' && (
        <div className="rec-stage">
          <IntroPlayer name={st.intro.name} appearance={st.intro.appearance} size={size} clean onReady={(h) => void introReady(h)} onDone={introEnded} />
        </div>
      )}

      {st.phase === 'countdown' && (
        <div className="rec-countdown" aria-live="assertive">
          <span key={st.countdown}>{st.countdown}</span>
        </div>
      )}

      {live && (
        <div className={st.phase === 'paused' ? 'rec-pill paused' : 'rec-pill'} role="status">
          <i className="rec-dot" aria-hidden />
          <b>{st.phase === 'paused' ? t.paused : st.phase === 'finishing' ? t.finishing : t.rec}</b>
          <span className="rec-time">{clock(st.elapsed)}</span>
          {st.phase !== 'finishing' && (
            <>
              <button type="button" onClick={() => (st.phase === 'paused' ? resume() : pause())}>{st.phase === 'paused' ? t.resume : t.pause}</button>
              <button type="button" className="danger" onClick={() => void finish()}>{t.stop}</button>
            </>
          )}
        </div>
      )}

      {st.kind === 'match' && replayMatch && game && st.phase !== 'done' && st.phase !== 'idle' && (
        <div className="rec-stage rec-replay">
          <PitchReplay match={replayMatch} clubs={game.clubs} personaName={game.persona.name} personaPosition={game.persona.position} personaLook={game.persona.appearance} onFinished={replayFinished} hold={st.phase !== 'recording'} />
        </div>
      )}

      {st.phase === 'done' && r && (
        <div className="modal rec-result" role="dialog" aria-modal="true" aria-label={t.preview}>
          <div className="modal-box">
            <h2>{t.preview}</h2>
            <video src={r.url} controls playsInline className={`rec-video a${st.settings.aspect.replace(':', 'x')}`} />
            <p className="muted small">{t.info(r.format, (r.blob.size / 1_048_576).toFixed(1), r.seconds)}</p>
            {r.format !== 'MP4' && <p className="muted small">{t.mp4Tip}</p>}
            {canShareFiles() && <p className="muted small">{t.shareHint}</p>}
            <div className="row">
              {canShareFiles() && (
                <button type="button" className="primary" onClick={() => void shareVideo(r, fileName(st.kind ?? 'video', st.settings.aspect, r.mime))}>
                  {t.share}
                </button>
              )}
              <a className={canShareFiles() ? 'button' : 'button primary'} href={r.url} download={fileName(st.kind ?? 'video', st.settings.aspect, r.mime)}>
                {t.download}
              </a>
              <button type="button" onClick={again}>{t.again}</button>
              <button type="button" onClick={closeResult}>{t.close}</button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

export { recordIntro };
