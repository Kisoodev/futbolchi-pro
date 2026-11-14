/**
 * "Record video" tab of the admin panel: settings and the start buttons.
 * Loaded lazily, only inside the (token-protected) admin panel.
 */
import { useState } from 'react';
import { constants as C, type Appearance, type Gender } from '@futbolchi/engine';
import { recTexts } from '../i18n/recorder';
import { loadGame } from '../state/store';
import { recordIntro, recordScreen, updateSettings, useRecorder } from './controller';
import { canCaptureScreen, canRecord, type Aspect } from './media';

/** Ready-made looks for a sample hero when there is no saved game in this browser. */
const SAMPLE: Record<Gender, { name: string; look: Appearance }> = {
  male: { name: 'Jasur', look: { ...C.DEFAULT_APPEARANCE, gender: 'male', hairStyle: 'sidepart', skinTone: 'medium', heightCm: 178 } },
  female: { name: 'Malika', look: { ...C.DEFAULT_APPEARANCE, gender: 'female', hairStyle: 'ponytail', skinTone: 'medium', heightCm: 168, weightKg: 58, brows: 'thin', nose: 'small' } },
};

export default function RecorderPanel() {
  const st = useRecorder();
  const t = recTexts();
  const s = st.settings;
  const saved = loadGame()?.persona ?? null;
  const [gender, setGender] = useState<Gender>(saved?.appearance.gender ?? 'male');
  const [name, setName] = useState(saved?.name ?? SAMPLE.male.name);
  const busy = st.phase !== 'idle' && st.phase !== 'done';

  const heroLook = (): Appearance => (saved && saved.appearance.gender === gender ? saved.appearance : SAMPLE[gender].look);
  const switchGender = (g: Gender) => {
    setGender(g);
    if (!saved || saved.appearance.gender !== g) setName(SAMPLE[g].name);
    else setName(saved.name);
  };
  const openPhoneWindow = () => {
    const h = Math.min(screen.availHeight - 40, 860);
    window.open(`${location.origin}/`, 'futbolchi-phone', `popup,width=${Math.round((h * 9) / 16)},height=${h}`);
  };

  const radio = <T extends string | number>(value: T, options: readonly T[], label: (o: T) => string, on: (v: T) => void) => (
    <div className="chips tight">
      {options.map((o) => (
        <button key={String(o)} type="button" className={o === value ? 'chip on' : 'chip'} aria-pressed={o === value} onClick={() => on(o)} disabled={busy}>
          {label(o)}
        </button>
      ))}
    </div>
  );

  return (
    <section className="admin-rec">
      <p className="muted small rec-intro">{t.intro}</p>
      {!canRecord() && <p className="error">{t.notSupported}</p>}
      {st.message && <p className="muted small">{st.message}</p>}

      <div className="rec-grid">
        <div className="rec-card">
          <h3>{t.settings}</h3>
          <div className="field">
            <span>{t.aspect}</span>
            {radio<Aspect>(s.aspect, ['9:16', '16:9', '1:1'], (o) => t.aspects[o], (v) => updateSettings({ aspect: v }))}
          </div>
          <div className="field inline">
            <span>{t.quality}</span>
            {radio<720 | 1080>(s.quality, [720, 1080], (o) => `${o}p`, (v) => updateSettings({ quality: v }))}
          </div>
          <div className="field inline">
            <span>{t.fps}</span>
            {radio<30 | 60>(s.fps, [30, 60], (o) => `${o} FPS`, (v) => updateSettings({ fps: v }))}
          </div>
          <label className="field">
            <span>{t.bitrate(s.bitrate)}</span>
            <input type="range" min={2} max={16} step={1} value={s.bitrate} disabled={busy} onChange={(e) => updateSettings({ bitrate: Number(e.target.value) })} />
          </label>
        </div>

        <div className="rec-card">
          <h3>🔊 / 🏷️</h3>
          <div className="rec-checks">
            <label><input type="checkbox" checked={s.audio} disabled={busy} onChange={(e) => updateSettings({ audio: e.target.checked })} /> {t.sound}</label>
            <label><input type="checkbox" checked={s.mic} disabled={busy} onChange={(e) => updateSettings({ mic: e.target.checked })} /> {t.mic}</label>
            <label><input type="checkbox" checked={s.endCard} disabled={busy} onChange={(e) => updateSettings({ endCard: e.target.checked })} /> {t.endCard}</label>
            <label><input type="checkbox" checked={s.watermark} disabled={busy} onChange={(e) => updateSettings({ watermark: e.target.checked })} /> {t.watermark}</label>
          </div>
          {s.watermark && (
            <label className="field">
              <span>{t.watermarkOpacity(s.watermarkOpacity)}</span>
              <input type="range" min={20} max={100} step={5} value={s.watermarkOpacity} disabled={busy} onChange={(e) => updateSettings({ watermarkOpacity: Number(e.target.value) })} />
            </label>
          )}
          <p className="muted small">{t.shortcuts}</p>
          {st.overlayWarning && <p className="muted small">{t.overlayVisible}</p>}
        </div>

        <div className="rec-card">
          <h3>{t.hero}</h3>
          {radio<Gender>(gender, ['male', 'female'], (o) => t.gender[o], switchGender)}
          <label className="field">
            <span>{t.heroName}</span>
            <input value={name} maxLength={24} disabled={busy} title={saved && saved.appearance.gender === gender ? t.heroFromSave : undefined} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="button" className="primary big" title={t.recordIntroNote} disabled={busy || !canRecord() || name.trim().length < 2} onClick={() => recordIntro({ name: name.trim(), appearance: heroLook() })}>
            {t.recordIntro}
          </button>
          <div className="rec-row">
            <button type="button" title={t.recordScreenNote} disabled={busy || !canCaptureScreen()} onClick={() => void recordScreen()}>
              {t.recordScreen}
            </button>
            <button type="button" title={t.phoneWindowNote} disabled={!canCaptureScreen()} onClick={openPhoneWindow}>
              {t.phoneWindow}
            </button>
          </div>
          <p className="muted small">{canCaptureScreen() ? t.recordScreenNote : t.noScreen}</p>
        </div>
      </div>
    </section>
  );
}
