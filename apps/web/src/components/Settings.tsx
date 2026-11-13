import { useEffect, useState } from 'react';
import { tx } from '../i18n';
import { LangSwitch } from './LangSwitch';

/** ⚙️ in the in-game top bar: a small sheet with the language choice. */
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <button type="button" className="settings-btn" aria-label={tx.settingsTitle} title={tx.settingsTitle} onClick={() => setOpen(true)}>
        ⚙️
      </button>
      {open && (
        <div className="modal settings-modal" role="dialog" aria-modal="true" aria-label={tx.settingsTitle} onClick={() => setOpen(false)}>
          <div className="modal-box settings-sheet" onClick={(e) => e.stopPropagation()}>
            <h2>⚙️ {tx.settingsTitle}</h2>
            <div className="settings-row">
              <span>{tx.settingsLanguage}</span>
              <LangSwitch />
            </div>
            <button type="button" className="big" onClick={() => setOpen(false)}>
              {tx.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
