import { LANG_LABELS, LANGS, setLang, tx, useLang } from '../i18n';

/** UZ / EN / RU switch, top-right on every screen. Switching is instant. */
export function LangSwitch({ floating = false }: { floating?: boolean }) {
  const current = useLang();
  return (
    <div className={`lang-switch ${floating ? 'floating' : ''}`} role="group" aria-label={tx.langLabel}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          className={l === current ? 'on' : ''}
          aria-pressed={l === current}
          title={LANG_LABELS[l].name}
          onClick={() => setLang(l)}
        >
          {LANG_LABELS[l].short}
        </button>
      ))}
    </div>
  );
}
