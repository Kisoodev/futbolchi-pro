/**
 * Auto-generated season story. Facts are computed from stored match data;
 * the text is produced in the player's language (Uzbek is the default).
 * Every language must cover the same cases — see test/story.test.ts.
 */
import { TIER_NAMES } from './league';

/** Languages the game ships in. Add a language here and the compiler lists every place to translate. */
export const LANGS = ['uz', 'en', 'ru'] as const;
export type Lang = (typeof LANGS)[number];

/** Russian needs case forms: nominative, accusative ("в ..."), prepositional ("в ..."). */
interface RuForms {
  nom: string;
  acc: string;
  prep: string;
}

export const TIER_NAMES_I18N: { uz: Record<Tier, string>; en: Record<Tier, string>; ru: Record<Tier, RuForms> } = {
  uz: TIER_NAMES,
  en: { 1: 'Gold League', 2: 'Silver League', 3: 'Bronze League', 4: 'Academy League' },
  ru: {
    1: { nom: 'Золотая лига', acc: 'Золотую лигу', prep: 'Золотой лиге' },
    2: { nom: 'Серебряная лига', acc: 'Серебряную лигу', prep: 'Серебряной лиге' },
    3: { nom: 'Бронзовая лига', acc: 'Бронзовую лигу', prep: 'Бронзовой лиге' },
    4: { nom: 'Лига академий', acc: 'Лигу академий', prep: 'Лиге академий' },
  },
};

/** Display name of a league in the given language. */
export function tierName(tier: Tier, lang: Lang): string {
  return lang === 'ru' ? TIER_NAMES_I18N.ru[tier].nom : TIER_NAMES_I18N[lang][tier];
}

/** Russian plural: 1 гол, 2 гола, 5 голов (also 21 гол, 11 голов). */
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

const enPlural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const enOrdinal = (n: number) => {
  const a = n % 100;
  if (a >= 11 && a <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

export function seasonStory(f: SeasonFacts, lang: Lang): string {
  if (lang === 'en') return seasonStoryEn(f);
  if (lang === 'ru') return seasonStoryRu(f);
  return seasonStoryUz(f);
}

function closingLine(avg: number | null, high: string, mid: string, low: string): string {
  if (avg !== null && avg >= 7.5) return high;
  if (avg !== null && avg >= 6.5) return mid;
  return low;
}

export function seasonStoryEn(f: SeasonFacts): string {
  const tier = TIER_NAMES_I18N.en[f.tier];
  const next = TIER_NAMES_I18N.en[f.nextTier];
  const matches = (n: number) => `${n} ${enPlural(n, 'match', 'matches')}`;
  const parts: string[] = [f.seasonIndex === 1 ? 'It all started at a small academy.' : `Season ${f.seasonIndex}.`];

  if (f.apps === 0) parts.push("You didn't get on the pitch this season, but every training session made you stronger.");
  else if (f.position === 'GK') parts.push(`In ${matches(f.apps)} you made ${f.saves} ${enPlural(f.saves, 'save', 'saves')}.`);
  else if (f.goals + f.assists === 0) parts.push(`You played ${matches(f.apps)} and gave everything for the team.`);
  else if (f.assists === 0) parts.push(`You scored ${f.goals} ${enPlural(f.goals, 'goal', 'goals')} in ${matches(f.apps)}.`);
  else if (f.goals === 0) parts.push(`You made ${f.assists} ${enPlural(f.assists, 'assist', 'assists')} in ${matches(f.apps)}.`);
  else
    parts.push(
      `You scored ${f.goals} ${enPlural(f.goals, 'goal', 'goals')} and made ${f.assists} ${enPlural(f.assists, 'assist', 'assists')} in ${matches(f.apps)}.`,
    );

  if (f.best && f.apps > 1) {
    const g = f.best.goals > 0 ? `, with ${f.best.goals} ${enPlural(f.best.goals, 'goal', 'goals')}` : '';
    parts.push(`Your best game: against ${f.best.opponentName}, rated ${f.best.rating.toFixed(1)}${g}.`);
  }
  if (f.injuries > 0) parts.push(`An injury kept you out for ${f.injuryWeeks} ${enPlural(f.injuryWeeks, 'week', 'weeks')}, but you came back.`);

  if (f.finalPosition === 1 && f.outcome === 'promoted') parts.push(`${f.clubName} won the ${tier} and were promoted to the ${next}!`);
  else if (f.finalPosition === 1) parts.push(`${f.clubName} won the ${tier}!`);
  else if (f.outcome === 'promoted') parts.push(`Your team finished ${enOrdinal(f.finalPosition)} and were promoted to the ${next}!`);
  else if (f.outcome === 'relegated')
    parts.push(`The team finished ${enOrdinal(f.finalPosition)} and dropped to the ${next}. But a real footballer always gets back up.`);
  else parts.push(`The team finished ${enOrdinal(f.finalPosition)} in the ${tier}.`);

  if (f.transferOffered) parts.push('Bigger clubs are interested in you!');
  parts.push(
    closingLine(
      f.avgRating,
      'You are on your way to becoming a star.',
      'The journey goes on — every week counts.',
      'The dream is big, and the work must be even bigger. Keep going!',
    ),
  );
  return parts.join(' ');
}

export function seasonStoryRu(f: SeasonFacts): string {
  const tier = TIER_NAMES_I18N.ru[f.tier];
  const next = TIER_NAMES_I18N.ru[f.nextTier];
  const matches = (n: number) => `${n} ${ruPlural(n, 'матч', 'матча', 'матчей')}`;
  const parts: string[] = [f.seasonIndex === 1 ? 'Всё началось в маленькой академии.' : `Сезон ${f.seasonIndex}.`];

  if (f.apps === 0) parts.push('В этом сезоне выйти на поле не удалось, но каждая тренировка сделала вас сильнее.');
  else if (f.position === 'GK')
    parts.push(`За ${matches(f.apps)} вы совершили ${f.saves} ${ruPlural(f.saves, 'сейв', 'сейва', 'сейвов')}.`);
  else if (f.goals + f.assists === 0) parts.push(`Вы сыграли ${matches(f.apps)} и отдали все силы команде.`);
  else if (f.assists === 0) parts.push(`За ${matches(f.apps)} вы забили ${f.goals} ${ruPlural(f.goals, 'гол', 'гола', 'голов')}.`);
  else if (f.goals === 0)
    parts.push(`За ${matches(f.apps)} вы отдали ${f.assists} ${ruPlural(f.assists, 'голевую передачу', 'голевые передачи', 'голевых передач')}.`);
  else
    parts.push(
      `За ${matches(f.apps)} вы забили ${f.goals} ${ruPlural(f.goals, 'гол', 'гола', 'голов')} и отдали ${f.assists} ${ruPlural(f.assists, 'голевую передачу', 'голевые передачи', 'голевых передач')}.`,
    );

  if (f.best && f.apps > 1) {
    const g = f.best.goals > 0 ? `, голов: ${f.best.goals}` : '';
    parts.push(`Лучший матч — против «${f.best.opponentName}»: оценка ${f.best.rating.toFixed(1)}${g}.`);
  }
  if (f.injuries > 0)
    parts.push(`Травма вывела вас из строя на ${f.injuryWeeks} ${ruPlural(f.injuryWeeks, 'неделю', 'недели', 'недель')}, но вы вернулись.`);

  if (f.finalPosition === 1 && f.outcome === 'promoted') parts.push(`«${f.clubName}» стал чемпионом в ${tier.prep} и поднялся в ${next.acc}!`);
  else if (f.finalPosition === 1) parts.push(`«${f.clubName}» стал чемпионом в ${tier.prep}!`);
  else if (f.outcome === 'promoted') parts.push(`Ваша команда заняла ${f.finalPosition}-е место и поднялась в ${next.acc}!`);
  else if (f.outcome === 'relegated')
    parts.push(`Команда заняла ${f.finalPosition}-е место и опустилась в ${next.acc}. Но настоящий футболист всегда поднимается снова.`);
  else parts.push(`Команда заняла ${f.finalPosition}-е место в ${tier.prep}.`);

  if (f.transferOffered) parts.push('Вами интересуются клубы посильнее!');
  parts.push(
    closingLine(
      f.avgRating,
      'Вы на пути к тому, чтобы стать звездой.',
      'Путь продолжается — каждая неделя важна.',
      'Мечта большая, а работа должна быть ещё больше. Вперёд!',
    ),
  );
  return parts.join(' ');
}
import type { GameState, Position, SeasonOutcome, Tier } from './types';

export interface SeasonFacts {
  personaName: string;
  position: Position;
  seasonIndex: number;
  clubName: string;
  tier: Tier;
  /** Uzbek name; use tierName(tier, lang) for other languages. */
  tierName: string;
  /** Tier the persona's club plays in next season. */
  nextTier: Tier;
  /** Uzbek name of nextTier. */
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
    nextTier,
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
  } else if (f.assists === 0) {
    parts.push(`${f.apps} ta o'yinda ${f.goals} ta gol urdingiz.`);
  } else if (f.goals === 0) {
    parts.push(`${f.apps} ta o'yinda ${f.assists} ta golli pas berdingiz.`);
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
