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
  // progression (docs/PROGRESSION_SYSTEM.md)
  ratingUp: (level: number) => string;
  cardTiers: Record<string, string>;
  milestone: (level: number) => string;
  milestoneShare: (name: string, level: number) => string;
  share: string;
  seasonGrowth: (from: number, to: number) => string;
  captainGap: (gap: number) => string;
  captainAbove: (gap: number) => string;
  matchXpLine: (rating: string) => string;
  pointUp: (n: number) => string;
  almost: string;
  ratingSame: string;
  growHint: string;
  trainHint: string;
  trainFocus: string;
  fatigue: { down: string; low: string; mid: string; high: string };
  injuryRisk: string;
  stage: (n: number, of: number) => string;
  goalUp: (league: string, next: string) => string;
  goalTop: string;
  paywallCoach: string;
  paywallRestart: string;
  lineupTitle: string;
  lineupButton: string;
  lineupBench: string;
  lineupYou: string;
  lineupRival: string;
  lineupFriend: string;
  rivalLine: (name: string, theirs: number, mine: number) => string;
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
  xpGained: (x) => `+${x} ⭐`,
  levelUp: (l) => `Yangi daraja: ${l}!`,
  missionDone: 'Missiya bajarildi',
  continue: 'Davom etish →',
  toMatchDay: "Ertaga — o'yin kuni →",
  level: (n) => `${n}-daraja`,
  levelShort: 'Daraja',
  xpOf: (x, n) => `${x} / ${n} ⭐`,
  accountTitle: 'Akkaunt darajasi',
  accountText: "Mashg'ulot, o'yin, g'alaba, yaxshi reyting, futbolchingni kuchaytirish va missiyalar uchun ⭐ ochko olasan.",
  missionsTitle: 'Missiyalar',
  missionReward: (x) => `+${x} ⭐`,
  missionNames: {
    train: (t) => `${t} ta mashg'ulot o'tkaz`,
    play: (t) => `${t} ta o'yinda maydonga tush`,
    goodGame: (t) => `${t} ta o'yinda 7.0+ reyting ol`,
    win: (t) => `${t} ta o'yinda g'alaba qozon`,
    contribute: (t) => `${t} ta gol yoki golli pas ber`,
    ovr: (t) => `Umumiy reytingni ${t} ochkoga oshir`,
  },
  totals: (m, x) => `Bajarilgan missiyalar: ${m} · Jami: ${x} ⭐`,
  close: 'Yopish',
  ratingUp: (l) => `Reyting ${l}!`,
  cardTiers: { Bronza: 'Bronza', Kumush: 'Kumush', Oltin: 'Oltin', Elit: 'Elit', Afsona: 'Afsona', Ikona: 'Ikona' },
  milestone: (l) => `🏅 ${l} reytingga yetding!`,
  milestoneShare: (n, l) => `${n} Futbolchi Pro'da ${l} reytingga yetdi! ⚽`,
  share: '📤 Ulashish',
  seasonGrowth: (a, b) => `Mavsum boshida ${a} eding → endi ${b} (+${b - a})`,
  captainGap: (g) => `Kapitandan ${g} reyting pastdasan`,
  captainAbove: (g) => `Kapitandan ${g} reyting yuqorisan!`,
  matchXpLine: (r) => `Reyting ${r}`,
  pointUp: (n) => `+${n}`,
  almost: "o'smoqda",
  ratingSame: "Reyting o'z joyida — o'sish to'planmoqda",
  growHint: "Yashil qism — bugun qo'shilgan kuch. Chiziq to'lganda ko'rsatkich bittaga oshadi.",
  trainHint: "Uchtasidan bittasini tanla: o'sha mashg'ulot o'z ko'rsatkichlarini kuchaytiradi.",
  trainFocus: 'Kuchaytiradi',
  fatigue: { down: 'Charchoq kamayadi', low: 'Charchoq: kam', mid: "Charchoq: o'rtacha", high: "Charchoq: ko'p" },
  injuryRisk: 'Jarohat xavfi bor',
  stage: (n, of) => `${n}/${of}-bosqich`,
  goalUp: (l, n) => `Maqsad: ${l}ni yutib, ${n}ga chiqish`,
  goalTop: "Maqsad: 1-liga chempioni bo'lish",
  paywallCoach: "«Ertaga soat 7 da maydondasan. Kechikma!» Karyerangni boshlash uchun akademiyaga yozil.",
  paywallRestart: 'Boshqa futbolchi yaratish',
  lineupTitle: 'Bugungi tarkib',
  lineupButton: '📋 Tarkibni ko\'rish',
  lineupBench: 'Zaxirada',
  lineupYou: 'Sen',
  lineupRival: 'Odil — raqib',
  lineupFriend: "Abu — do'st",
  rivalLine: (n, a, b) => (a > b ? `😏 ${n} ${a} · Sen ${b} — ${a - b} ochko oldinda` : `🔥 ${n} ${a} · Sen ${b} — ${n}ni quvib o'tding!`),
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
  xpGained: (x) => `+${x} ⭐`,
  levelUp: (l) => `New level: ${l}!`,
  missionDone: 'Mission complete',
  continue: 'Continue →',
  toMatchDay: 'Tomorrow — match day →',
  level: (n) => `Level ${n}`,
  levelShort: 'Level',
  xpOf: (x, n) => `${x} / ${n} ⭐`,
  accountTitle: 'Account level',
  accountText: 'Earn ⭐ points for training, matches, wins, good ratings, making your player stronger and missions.',
  missionsTitle: 'Missions',
  missionReward: (x) => `+${x} ⭐`,
  missionNames: {
    train: (t) => `Complete ${t} training sessions`,
    play: (t) => `Play in ${t} matches`,
    goodGame: (t) => `Get a 7.0+ rating in ${t} ${t === 1 ? 'match' : 'matches'}`,
    win: (t) => `Win ${t} ${t === 1 ? 'match' : 'matches'}`,
    contribute: (t) => `Make ${t} goals or assists`,
    ovr: (t) => `Raise your overall rating by ${t}`,
  },
  totals: (m, x) => `Missions done: ${m} · Total: ${x} ⭐`,
  close: 'Close',
  ratingUp: (l) => `Rating ${l}!`,
  cardTiers: { Bronza: 'Bronze', Kumush: 'Silver', Oltin: 'Gold', Elit: 'Elite', Afsona: 'Legend', Ikona: 'Icon' },
  milestone: (l) => `🏅 You reached a ${l} rating!`,
  milestoneShare: (n, l) => `${n} reached a ${l} rating in Futbolchi Pro! ⚽`,
  share: '📤 Share',
  seasonGrowth: (a, b) => `You started the season at ${a} → now ${b} (+${b - a})`,
  captainGap: (g) => `${g} below your captain`,
  captainAbove: (g) => `${g} above your captain!`,
  matchXpLine: (r) => `Rating ${r}`,
  pointUp: (n) => `+${n}`,
  almost: 'growing',
  ratingSame: 'Rating holds — growth is building up',
  growHint: 'The green part is what you gained today. When a bar fills, the attribute goes up by one.',
  trainHint: 'Pick one of the three: that training strengthens its own attributes.',
  trainFocus: 'Strengthens',
  fatigue: { down: 'Less tired', low: 'Tiredness: low', mid: 'Tiredness: medium', high: 'Tiredness: high' },
  injuryRisk: 'Injury risk',
  stage: (n, of) => `Stage ${n} of ${of}`,
  goalUp: (l, n) => `Goal: win the ${l} and go up to the ${n}`,
  goalTop: 'Goal: become champions of the First League',
  paywallCoach: '"Tomorrow, 7 a.m., on the pitch. Don\'t be late!" Join the academy to start your career.',
  paywallRestart: 'Create a different player',
  lineupTitle: "Today's team",
  lineupButton: '📋 See the team',
  lineupBench: 'On the bench',
  lineupYou: 'You',
  lineupRival: 'Odil — rival',
  lineupFriend: 'Abu — friend',
  rivalLine: (n, a, b) => (a > b ? `😏 ${n} ${a} · You ${b} — ${a - b} ahead` : `🔥 ${n} ${a} · You ${b} — you passed ${n}!`),
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
  xpGained: (x) => `+${x} ⭐`,
  levelUp: (l) => `Новый уровень: ${l}!`,
  missionDone: 'Миссия выполнена',
  continue: 'Дальше →',
  toMatchDay: 'Завтра — день матча →',
  level: (n) => `Уровень ${n}`,
  levelShort: 'Уровень',
  xpOf: (x, n) => `${x} / ${n} ⭐`,
  accountTitle: 'Уровень аккаунта',
  accountText: '⭐ очки дают за тренировки, матчи, победы, хорошие оценки, рост игрока и миссии.',
  missionsTitle: 'Миссии',
  missionReward: (x) => `+${x} ⭐`,
  missionNames: {
    train: (t) => `Проведи тренировок: ${t}`,
    play: (t) => `Сыграй матчей: ${t}`,
    goodGame: (t) => `Оценка 7.0+ в матчах: ${t}`,
    win: (t) => `Выиграй матчей: ${t}`,
    contribute: (t) => `Голы или передачи: ${t}`,
    ovr: (t) => `Подними общий рейтинг на ${t}`,
  },
  totals: (m, x) => `Выполнено миссий: ${m} · Всего: ${x} ⭐`,
  close: 'Закрыть',
  ratingUp: (l) => `Рейтинг ${l}!`,
  cardTiers: { Bronza: 'Бронза', Kumush: 'Серебро', Oltin: 'Золото', Elit: 'Элита', Afsona: 'Легенда', Ikona: 'Икона' },
  milestone: (l) => `🏅 Ты достиг рейтинга ${l}!`,
  milestoneShare: (n, l) => `${n} достиг рейтинга ${l} в Futbolchi Pro! ⚽`,
  share: '📤 Поделиться',
  seasonGrowth: (a, b) => `В начале сезона было ${a} → теперь ${b} (+${b - a})`,
  captainGap: (g) => `На ${g} ниже капитана`,
  captainAbove: (g) => `На ${g} выше капитана!`,
  matchXpLine: (r) => `Оценка ${r}`,
  pointUp: (n) => `+${n}`,
  almost: 'растёт',
  ratingSame: 'Рейтинг на месте — рост копится',
  growHint: 'Зелёная часть — то, что прибавилось сегодня. Когда полоска заполнится, показатель вырастет на единицу.',
  trainHint: 'Выбери одну из трёх: эта тренировка усиливает свои показатели.',
  trainFocus: 'Усиливает',
  fatigue: { down: 'Усталость снизится', low: 'Усталость: низкая', mid: 'Усталость: средняя', high: 'Усталость: высокая' },
  injuryRisk: 'Есть риск травмы',
  stage: (n, of) => `Этап ${n} из ${of}`,
  goalUp: (l, n) => `Цель: выиграть «${l}» и выйти в «${n}»`,
  goalTop: 'Цель: стать чемпионом Первой лиги',
  paywallCoach: '«Завтра в 7 утра — на поле. Не опаздывай!» Запишись в академию, чтобы начать карьеру.',
  paywallRestart: 'Создать другого игрока',
  lineupTitle: 'Состав на сегодня',
  lineupButton: '📋 Посмотреть состав',
  lineupBench: 'В запасе',
  lineupYou: 'Ты',
  lineupRival: 'Одил — соперник',
  lineupFriend: 'Абу — друг',
  rivalLine: (n, a, b) => (a > b ? `😏 ${n} ${a} · Ты ${b} — впереди на ${a - b}` : `🔥 ${n} ${a} · Ты ${b} — ты обошёл ${n}!`),
};

const TEXTS: Record<Lang, ProgressTexts> = { uz, en, ru };
export const progressTexts = (): ProgressTexts => TEXTS[lang];
export { TEXTS as PROGRESS_TEXTS };
