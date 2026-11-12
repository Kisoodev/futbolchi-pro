/**
 * Auto-generated season story. Facts are computed from stored match data;
 * the text is Uzbek (Latin script), the default UI language.
 */
import { TIER_NAMES } from './league';
import type { GameState, Position, SeasonOutcome, Tier } from './types';

export interface SeasonFacts {
  personaName: string;
  position: Position;
  seasonIndex: number;
  clubName: string;
  tier: Tier;
  tierName: string;
  /** Tier the persona's club plays in next season. */
  nextTierName: string;
  matches: number;
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  saves: number;
  avgRating: number | null;
  best: { rating: number; opponentName: string; goals: number } | null;
  injuries: number;
  injuryWeeks: number;
  outcome: SeasonOutcome;
  finalPosition: number;
  transferOffered: boolean;
}

export function seasonFacts(state: GameState, seasonId: string): SeasonFacts {
  const season = state.seasons.find((s) => s.id === seasonId);
  if (!season) throw new Error(`unknown season ${seasonId}`);
  const p = state.persona;
  let apps = 0, starts = 0, goals = 0, assists = 0, saves = 0, injuries = 0, injuryWeeks = 0;
  const ratings: number[] = [];
  let best: SeasonFacts['best'] = null;
  for (const id of season.matchIds) {
    const m = state.matches[id];
    const ps = m?.personaStats;
    if (!m || !ps) continue;
    if (ps.injuryWeeks > 0) {
      injuries++;
      injuryWeeks += ps.injuryWeeks;
    }
    if (ps.rating === null) continue;
    apps++;
    if (ps.role === 'start') starts++;
    goals += ps.goals;
    assists += ps.assists;
    saves += ps.saves;
    ratings.push(ps.rating);
    if (!best || ps.rating > best.rating) {
      const oppId = m.personaSide === 'home' ? m.awayId : m.homeId;
      best = { rating: ps.rating, opponentName: state.clubs[oppId].name, goals: ps.goals };
    }
  }
  const nextTier = state.clubs[p.clubId].tier;
  return {
    personaName: p.name,
    position: p.position,
    seasonIndex: season.index,
    clubName: state.clubs[p.clubId].name,
    tier: season.tier,
    tierName: TIER_NAMES[season.tier],
    nextTierName: TIER_NAMES[nextTier],
    matches: season.matchIds.length,
    apps,
    starts,
    goals,
    assists,
    saves,
    avgRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    best,
    injuries,
    injuryWeeks,
    outcome: season.outcome ?? 'stayed',
    finalPosition: season.finalPosition ?? 0,
    transferOffered: state.transferOffers.length > 0 && season.id === state.seasons[state.seasons.length - 1].id,
  };
}

export function seasonStoryUz(f: SeasonFacts): string {
  const parts: string[] = [];
  parts.push(f.seasonIndex === 1 ? 'Hammasi kichik akademiyadan boshlandi.' : `${f.seasonIndex}-mavsum.`);

  if (f.apps === 0) {
    parts.push("Bu mavsum maydonga tushish nasib etmadi, ammo har bir mashg'ulot sizni kuchliroq qildi.");
  } else if (f.position === 'GK') {
    parts.push(`${f.apps} ta o'yinda ${f.saves} marta darvozani qutqardingiz.`);
  } else if (f.goals + f.assists === 0) {
    parts.push(`${f.apps} ta o'yinda maydonga tushib, jamoa uchun jon kuydirdingiz.`);
  } else {
    parts.push(`${f.apps} ta o'yinda ${f.goals} ta gol urdingiz va ${f.assists} ta golli pas berdingiz.`);
  }

  if (f.best && f.apps > 1) {
    const g = f.best.goals > 0 ? `, ${f.best.goals} ta gol` : '';
    parts.push(`Eng yorqin o'yiningiz — ${f.best.opponentName} bilan bahs: reyting ${f.best.rating.toFixed(1)}${g}.`);
  }

  if (f.injuries > 0) parts.push(`Jarohat sizni ${f.injuryWeeks} hafta safdan chiqardi, lekin siz qaytdingiz.`);

  if (f.finalPosition === 1 && f.outcome === 'promoted') {
    parts.push(`${f.clubName} ${f.tierName} chempioni bo'lib, ${f.nextTierName}ga ko'tarildi!`);
  } else if (f.finalPosition === 1) {
    parts.push(`${f.clubName} ${f.tierName} chempioni bo'ldi!`);
  } else if (f.outcome === 'promoted') {
    parts.push(`Jamoangiz ${f.finalPosition}-o'rinni egallab, ${f.nextTierName}ga ko'tarildi!`);
  } else if (f.outcome === 'relegated') {
    parts.push(
      `Jamoa ${f.finalPosition}-o'rinda yakunlab, ${f.nextTierName}ga tushib ketdi. Ammo haqiqiy futbolchi yiqilsa ham qayta turadi.`,
    );
  } else if (f.finalPosition !== 1) {
    parts.push(`Jamoa ${f.tierName}da ${f.finalPosition}-o'rinni egalladi.`);
  }

  if (f.transferOffered) parts.push('Kattaroq klublar sizga qiziqish bildirmoqda!');

  if (f.avgRating !== null && f.avgRating >= 7.5) parts.push('Siz yulduzga aylanib bormoqdasiz.');
  else if (f.avgRating !== null && f.avgRating >= 6.5) parts.push("Yo'l davom etadi — har bir hafta muhim.");
  else parts.push("Orzu katta, mehnat esa undan ham katta bo'lishi kerak. Oldinga!");

  return parts.join(' ');
}
