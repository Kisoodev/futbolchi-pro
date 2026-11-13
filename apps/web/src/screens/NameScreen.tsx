import { useState } from 'react';
import { tx } from '../i18n';
import { api } from '../state/api';
import { getUserId, getUserName, setUserName } from '../state/store';
import { PixelArt } from '../art/PixelArt';
import { BALL } from '../art/sprites';
import { openAdmin } from '../state/admin';

const NAME_MIN = 2;
const NAME_MAX = 24;

/** First page after loading: an attention message and the nickname. */
export function NameScreen({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState(() => getUserName());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = name.trim();
  const valid = clean.length >= NAME_MIN && clean.length <= NAME_MAX;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.register(getUserId(), clean);
      if (res.admin) {
        // Secret owner nickname: open the admin login instead of saving the name.
        setBusy(false);
        setName(getUserName());
        openAdmin();
        return;
      }
      setUserName(clean);
      onDone(clean);
    } catch {
      setError(tx.serverDown);
      setBusy(false);
    }
  };

  return (
    <div className="screen center hero">
      <PixelArt sprite={BALL} scale={6} className="ball-logo" />
      <h1>{tx.appName}</h1>

      <form
        className="name-card"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="attention" role="note">
          <span className="attention-tag">{tx.nameAttention}</span>
          <strong>{tx.nameTitle}</strong>
          <p>{tx.nameText}</p>
        </div>
        <label className="field-label" htmlFor="nick">{tx.menuNameTitle}</label>
        <label className="name-input">
          <span aria-hidden>@</span>
          <input
            id="nick"
            value={name}
            maxLength={NAME_MAX}
            placeholder={tx.menuNamePlaceholder}
            autoComplete="nickname"
            spellCheck={false}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p className="muted small">{tx.menuNameHint}</p>
        {error && <p className="error">{error}</p>}
        <button className="primary big" type="submit" disabled={!valid || busy}>
          {tx.continue} →
        </button>
      </form>
    </div>
  );
}
