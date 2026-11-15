import { cardTier } from '@futbolchi/engine';
import { progressTexts } from '../i18n/progress';

/** Colour of each card tier (docs/PROGRESSION_SYSTEM.md §8). */
export const CARD_COLORS: Record<string, string> = {
  Bronza: '#b0703c',
  Kumush: '#9aa7b4',
  Oltin: '#e0a526',
  Elit: '#3a7bd5',
  Afsona: '#8a4fd1',
  Ikona: '#e64980',
};

/** The rating as a small card in its tier colour (Bronza … Ikona). */
export function RatingCard({ level, size = 'md' }: { level: number; size?: 'sm' | 'md' | 'lg' }) {
  const tier = cardTier(level);
  return (
    <span className={`rating-card ${size}`} style={{ ['--card' as string]: CARD_COLORS[tier] }}>
      <strong>{level}</strong>
      <small>{progressTexts().cardTiers[tier]}</small>
    </span>
  );
}
