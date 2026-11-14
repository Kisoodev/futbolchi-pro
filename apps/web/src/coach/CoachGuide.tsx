/**
 * The in-game coach: Rustam Sobirov's portrait and words at the bottom of the
 * screen, walking the player through a lesson step by step. The part of the
 * screen he talks about is lit up (everything else dims). Every lesson can be
 * skipped; it is shown once (see coachStore).
 */
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { characterName } from '../characters';
import { Portrait } from '../characters/Portrait';
import { coachTexts, type CoachStep, type CoachVars, type LessonId, type WeekView } from '../i18n/coach';
import { lessonDue, markLesson, useCoachState } from './coachStore';

interface Props {
  lesson: LessonId;
  vars: CoachVars;
  /** Phones: switch the week tab a step talks about. */
  onView?: (v: WeekView) => void;
  /** Wait a little so the screen has laid out (ms). */
  delay?: number;
}

const visible = (el: Element | null): el is HTMLElement => {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
};
const findTarget = (step: CoachStep): HTMLElement | null => {
  for (const sel of step.target ?? []) {
    const el = [...document.querySelectorAll(sel)].find(visible);
    if (el) return el as HTMLElement;
  }
  return null;
};

export function CoachGuide({ lesson, vars, onView, delay = 350 }: Props) {
  const coach = useCoachState();
  const t = coachTexts();
  const steps = t.lessons[lesson];
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const due = lessonDue(coach, lesson);

  useEffect(() => {
    if (!due) return;
    setI(0);
    const id = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(id);
  }, [due, delay]);

  const step = steps[i];
  // switch the phone tab first, then find and light up the target
  useLayoutEffect(() => {
    if (!due || !ready || !step) return;
    if (step.view) onView?.(step.view);
  }, [due, ready, step, onView]);

  useEffect(() => {
    if (!due || !ready || !step) return;
    let raf = 0;
    let frames = 0;
    let last = '';
    const track = () => {
      const el = findTarget(step);
      // a step that points at something not on this screen is skipped
      if (step.target && !el) {
        if (frames++ > 6) setI((n) => Math.min(n + 1, steps.length));
        else raf = requestAnimationFrame(track);
        return;
      }
      if (el && frames === 0) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const r = el ? el.getBoundingClientRect() : null;
      const key = r ? `${r.left|0},${r.top|0},${r.width|0},${r.height|0}` : '-';
      if (key !== last) {
        last = key;
        setRect(r);
      }
      frames++;
      raf = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(raf);
  }, [due, ready, step, steps.length]);

  const finish = useMemo(() => () => markLesson(lesson), [lesson]);
  useEffect(() => {
    if (due && ready && i >= steps.length) finish();
  }, [due, ready, i, steps.length, finish]);

  useEffect(() => {
    if (!due || !ready) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [due, ready, finish]);

  if (!due || !ready || !step) return null;
  const last = i === steps.length - 1;
  // keep the coach clear of what he is pointing at
  const atTop = !!rect && rect.top + rect.height / 2 > window.innerHeight * 0.55;
  const pad = 6;

  return (
    <>
      {rect ? (
        <div className="coach-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} aria-hidden />
      ) : (
        <div className="coach-dim" aria-hidden />
      )}
      <div className={atTop ? 'coach-guide top' : 'coach-guide'} role="dialog" aria-label={t.title}>
        <Portrait id="coach" size={60} className="coach-portrait" />
        <div className="coach-body">
          <div className="coach-head">
            <b>{t.title}</b>
            <span className="muted">{characterName('coach')}</span>
            <small className="coach-count">{t.step(i + 1, steps.length)}</small>
          </div>
          <p key={i} className="coach-text">
            {step.text(vars)}
          </p>
          <div className="coach-actions">
            <button type="button" className="link coach-skip" onClick={finish}>
              {t.skip}
            </button>
            <span className="row">
              {i > 0 && (
                <button type="button" onClick={() => setI(i - 1)} aria-label="back">
                  {t.back}
                </button>
              )}
              <button type="button" className="primary" onClick={() => (last ? finish() : setI(i + 1))}>
                {last ? t.done : t.next}
              </button>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
