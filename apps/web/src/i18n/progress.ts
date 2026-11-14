/**
 * Texts for the training/match days, the growth animation, the account level
 * and missions — in Uzbek, English and Russian.
 */
import type { MissionKind } from '@futbolchi/engine';
import { lang, type Lang } from './index';

export interface ProgressTexts {
  dayTraining: string;
  dayMatch: string;
  dayChip: (day: 1 | 2) => string;
  trainButton: string;
  matchDayTitle: string;
  matchDayText: string;
  todayTrained: (name: string) => string;
  todayRested: string;
  playMatch: string;
  tabToday: { training: string; match: string };
  // growth reveal
  trainingDone: string;
  matchGrowth: string;
  noGrowth: string;
  restGrowth: string;
  benched: string;
  ovr: string;
  xpGained: (xp: number) => string;
  levelUp: (level: number) => string;
  missionDone: string;
  continue: string;
  toMatchDay: string;
  // account
  level: (n: number) => string;
  levelShort: string;
  xpOf: (xp: number, need: number) => string;
  accountTitle: string;
  accountText: string;
  missionsTitle: string;
  missionReward: (xp: number) => string;
  missionNames: Record<MissionKind, (target: number) => string>;
  totals: (missions: number, totalXp: number) => string;
  close: string;
}

const uz: ProgressTexts = {
  dayTraining: "Mashg'ulot kuni",
  dayMatch: "O'yin kuni",
  dayChip: (d) => (d === 1 ? "1-kun · Mashg'ulot" : "2-kun · O'yin"),
  trainButton: "Mashg'ulotni boshlash",
  matchDayTitle: "Bugun — o'yin kuni!",
  matchDayText: "Kecha mashg'ulot qilding. Endi maydonda ko'rsat: qanchalik yaxshi o'ynasang, shuncha ko'p o'sasan.",
  todayTrained: (n) => `Kechagi mashg'ulot: ${n}`,
  todayRested: 'Kecha dam olding — oyoqlar tetik.',
  playMatch: "O'yinga chiqish ⚽",
  tabToday: { training: "Mashg'ulot", match: "O'yin" },
  trainingDone: "Mashg'ulot yakunlandi!",
  matchGrowth: "O'yindan keyingi o'sish",
  noGrowth: "Bu safar ko'rsatkichlar o'zgarmadi.",
  restGrowth: 'Dam olding: charchoq kamaydi, kuch tiklandi.',
  benched: "Bu safar zaxirada qolding. Mashg'ulotda kuchayib, asosiy tarkibdan joy ol!",
  ovr: 'Umumiy reyting',
  xpGained: (x) => `+${x} XP`,
  levelUp: (l) => `Yangi daraja: ${l}!`,
  missionDone: 'Missiya bajarildi',
  continue: 'Davom etish →',
  toMatchDay: "Ertaga — o'yin kuni →",
  level: (n) => `${n}-daraja`,
  levelShort: 'Daraja',
  xpOf: (x, n) => `${x} / ${n} XP`,
  accountTitle: 'Akkaunt darajasi',
  accountText: "Mashg'ulot, o'yin, g'alaba, yaxshi reyting, futbolchingni kuchaytirish va missiyalar uchun XP olasan.",
  missionsTitle: 'Missiyalar',
  missionReward: (x) => `+${x} XP`,
  missionNames: {
    train: (t) => `${t} ta mashg'ulot o'tkaz`,
    play: (t) => `${t} ta o'yinda maydonga tush`,
    goodGame: (t) => `${t} ta o'yinda 7.0+ reyting ol`,
    win: (t) => `${t} ta o'yinda g'alaba qozon`,
    contribute: (t) => `${t} ta gol yoki golli pas ber`,
    ovr: (t) => `Umumiy reytingni ${t} ochkoga oshir`,
  },
  totals: (m, x) => `Bajarilgan missiyalar: ${m} · Jami: ${x} XP`,
  close: 'Yopish',
};

const en: ProgressTexts = {
  dayTraining: 'Training day',
  dayMatch: 'Match day',
  dayChip: (d) => (d === 1 ? 'Day 1 · Training' : 'Day 2 · Match'),
  trainButton: 'Start training',
  matchDayTitle: "Today is match day!",
  matchDayText: 'You trained yesterday. Now show it on the pitch: the better you play, the more you grow.',
  todayTrained: (n) => `Yesterday's training: ${n}`,
  todayRested: 'You rested yesterday — fresh legs.',
  playMatch: 'Go to the match ⚽',
  tabToday: { training: 'Training', match: 'Match' },
  trainingDone: 'Training complete!',
  matchGrowth: 'Growth from the match',
  noGrowth: 'No stat changes this time.',
  restGrowth: 'You rested: fatigue down, energy back.',
  benched: 'You stayed on the bench this time. Get stronger in training and win a starting place!',
  ovr: 'Overall rating',
  xpGained: (x) => `+${x} XP`,
  levelUp: (l) => `New level: ${l}!`,
  missionDone: 'Mission complete',
  continue: 'Continue →',
  toMatchDay: 'Tomorrow — match day →',
  level: (n) => `Level ${n}`,
  levelShort: 'Level',
  xpOf: (x, n) => `${x} / ${n} XP`,
  accountTitle: 'Account level',
  accountText: 'Earn XP for training, matches, wins, good ratings, making your player stronger and missions.',
  missionsTitle: 'Missions',
  missionReward: (x) => `+${x} XP`,
  missionNames: {
    train: (t) => `Complete ${t} training sessions`,
    play: (t) => `Play in ${t} matches`,
    goodGame: (t) => `Get a 7.0+ rating in ${t} ${t === 1 ? 'match' : 'matches'}`,
    win: (t) => `Win ${t} ${t === 1 ? 'match' : 'matches'}`,
    contribute: (t) => `Make ${t} goals or assists`,
    ovr: (t) => `Raise your overall rating by ${t}`,
  },
  totals: (m, x) => `Missions done: ${m} · Total: ${x} XP`,
  close: 'Close',
};

const ru: ProgressTexts = {
  dayTraining: 'День тренировки',
  dayMatch: 'День матча',
  dayChip: (d) => (d === 1 ? 'День 1 · Тренировка' : 'День 2 · Матч'),
  trainButton: 'Начать тренировку',
  matchDayTitle: 'Сегодня — день матча!',
  matchDayText: 'Вчера была тренировка. Теперь покажи себя на поле: чем лучше игра, тем больше рост.',
  todayTrained: (n) => `Вчерашняя тренировка: ${n}`,
  todayRested: 'Вчера был отдых — ноги свежие.',
  playMatch: 'На матч ⚽',
  tabToday: { training: 'Тренировка', match: 'Матч' },
  trainingDone: 'Тренировка завершена!',
  matchGrowth: 'Рост после матча',
  noGrowth: 'На этот раз показатели не изменились.',
  restGrowth: 'Отдых: усталость ниже, силы вернулись.',
  benched: 'В этот раз — скамейка запасных. Становись сильнее на тренировках и завоюй место в старте!',
  ovr: 'Общий рейтинг',
  xpGained: (x) => `+${x} XP`,
  levelUp: (l) => `Новый уровень: ${l}!`,
  missionDone: 'Миссия выполнена',
  continue: 'Дальше →',
  toMatchDay: 'Завтра — день матча →',
  level: (n) => `Уровень ${n}`,
  levelShort: 'Уровень',
  xpOf: (x, n) => `${x} / ${n} XP`,
  accountTitle: 'Уровень аккаунта',
  accountText: 'XP дают за тренировки, матчи, победы, хорошие оценки, рост игрока и миссии.',
  missionsTitle: 'Миссии',
  missionReward: (x) => `+${x} XP`,
  missionNames: {
    train: (t) => `Проведи тренировок: ${t}`,
    play: (t) => `Сыграй матчей: ${t}`,
    goodGame: (t) => `Оценка 7.0+ в матчах: ${t}`,
    win: (t) => `Выиграй матчей: ${t}`,
    contribute: (t) => `Голы или передачи: ${t}`,
    ovr: (t) => `Подними общий рейтинг на ${t}`,
  },
  totals: (m, x) => `Выполнено миссий: ${m} · Всего: ${x} XP`,
  close: 'Закрыть',
};

const TEXTS: Record<Lang, ProgressTexts> = { uz, en, ru };
export const progressTexts = (): ProgressTexts => TEXTS[lang];
export { TEXTS as PROGRESS_TEXTS };
