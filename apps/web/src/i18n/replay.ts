/**
 * Texts of the live 2D replay (action names on the pitch) — Uzbek, English, Russian.
 */
import type { EventType, Outcome } from '@futbolchi/engine';
import { lang, type Lang } from './index';

export interface ReplayTexts {
  action: Record<EventType, string>;
  outcome: Partial<Record<Outcome, string>>;
  /** "Odil → Otabek" style line for a pass. */
  passTo: (from: string, to: string) => string;
  kickOff: string;
  secondHalf: string;
  legend: string;
  /** The persona's orders during the match (three levels each). */
  orders: {
    title: string;
    effort: string;
    mentality: string;
    confidence: string;
    levels: { effort: [string, string, string]; mentality: [string, string, string]; confidence: [string, string, string] };
    hints: { effort: [string, string, string]; mentality: [string, string, string]; confidence: [string, string, string] };
    /** Shown when an order was given. */
    given: (minute: number) => string;
    offPitch: string;
  };
  tabs: { events: string; lineups: string };
  stats: { possession: string; shots: string; onTarget: string };
  starters: string;
  bench: string;
  cameOn: string;
  sentOff: string;
}

const uz: ReplayTexts = {
  action: {
    SHORT_PASS: 'Qisqa pas',
    LONG_PASS: 'Uzun pas',
    THROUGH_BALL: 'Keskin pas',
    CROSS: 'Oshirib berish',
    DRIBBLE: 'Aldab o‘tish',
    KNOCK_AND_RUN: 'Tezlik bilan o‘tish',
    CARRY: 'To‘pni olib yurish',
    SHOOT: 'Zarba',
    HOLD_UP: 'To‘pni saqlash',
    CLEAR: 'Tozalash',
    BACK_PASS: 'Orqaga pas',
    TACKLE: 'To‘p olish',
    HEADER: 'Bosh bilan',
    LOOSE_BALL: 'Erkin to‘p uchun kurash',
    KICK_OFF: 'Boshlang‘ich zarba',
    THROW_IN: 'Aut',
    CORNER: 'Burchak',
    FREE_KICK: 'Jarima zarbasi',
    PENALTY: 'Penalti',
    GOAL_KICK: 'Darvozadan tepish',
    FOUL: 'Qoida buzish',
    SUB: 'Almashtirish',
    GK_CLAIM: 'Darvozabon ushladi',
  },
  outcome: {
    COMPLETE: 'aniq',
    LOOSE_KEPT: 'qiyinchilik bilan qabul qildi',
    LOOSE_LOST: 'qabul qilolmadi',
    INTERCEPTED: 'ushlab qolindi',
    OUT: 'autga',
    BEAT: 'o‘tib ketdi!',
    LOST: 'to‘pni yo‘qotdi',
    FOUL_WON: 'qoida buzildi',
    PUSHED_WIDE: 'chetga siqildi',
    GOAL: 'GOL!',
    SAVED_CAUGHT: 'darvozabon ushladi',
    SAVED_PARRIED: 'darvozabon qaytardi',
    BLOCKED: 'to‘sildi',
    OFF_TARGET: 'darvozadan tashqariga',
    WOODWORK: 'ustunga tegdi!',
    WON: 'to‘pni oldi',
    HELD: 'saqlab turdi',
    CLEARED: 'tozalandi',
    MISKICK: 'noto‘g‘ri tepdi',
    YELLOW: 'sariq kartochka',
    RED: 'qizil kartochka',
    CLAIMED: 'ushladi',
  },
  passTo: (from, to) => `${from} → ${to}`,
  kickOff: 'O‘yin boshlandi',
  secondHalf: 'Ikkinchi bo‘lim',
  legend: 'Oltin rang — siz',
  orders: {
    title: "Ko'rsatmalar",
    effort: 'Harakat',
    mentality: 'Uslub',
    confidence: 'Ishonch',
    levels: { effort: ['Tejamkor', "O'rtacha", 'Kuchli'], mentality: ['Himoyaviy', 'Muvozanat', 'Hujumkor'], confidence: ['Ehtiyotkor', "O'rtacha", 'Yuqori'] },
    hints: {
      effort: ['Kuchni tejaydi, kam charchaydi', 'Odatdagidek', "Kuchliroq o'ynaydi, lekin tez charchaydi"],
      mentality: ["Himoyaga ko'proq yordam beradi, kam zarba", 'Odatdagidek', "Ko'proq zarba va hujum, himoyaga qaytmaydi"],
      confidence: ['Xavfsiz pas beradi, kam aldaydi', 'Odatdagidek', "Ko'proq aldab o'tadi va tezlik bilan o'tib ketadi"],
    },
    given: (m) => `${m}-daqiqadan kuchga kirdi`,
    offPitch: "Siz maydonda emassiz",
  },
  tabs: { events: 'Voqealar', lineups: 'Zaxira' },
  stats: { possession: "To'pga egalik", shots: 'Zarbalar', onTarget: 'Darvozaga' },
  starters: 'Asosiy tarkib',
  bench: 'Zaxira',
  cameOn: 'maydonga tushdi',
  sentOff: 'chetlatildi',
};

const en: ReplayTexts = {
  action: {
    SHORT_PASS: 'Short pass',
    LONG_PASS: 'Long pass',
    THROUGH_BALL: 'Through ball',
    CROSS: 'Cross',
    DRIBBLE: 'Dribble',
    KNOCK_AND_RUN: 'Knock and run',
    CARRY: 'Carry',
    SHOOT: 'Shot',
    HOLD_UP: 'Hold-up play',
    CLEAR: 'Clearance',
    BACK_PASS: 'Back pass',
    TACKLE: 'Tackle',
    HEADER: 'Header',
    LOOSE_BALL: 'Loose ball',
    KICK_OFF: 'Kick-off',
    THROW_IN: 'Throw-in',
    CORNER: 'Corner',
    FREE_KICK: 'Free kick',
    PENALTY: 'Penalty',
    GOAL_KICK: 'Goal kick',
    FOUL: 'Foul',
    SUB: 'Substitution',
    GK_CLAIM: 'Keeper claims',
  },
  outcome: {
    COMPLETE: 'on target',
    LOOSE_KEPT: 'controlled with difficulty',
    LOOSE_LOST: 'loses control',
    INTERCEPTED: 'intercepted',
    OUT: 'out of play',
    BEAT: 'gets past!',
    LOST: 'loses the ball',
    FOUL_WON: 'fouled',
    PUSHED_WIDE: 'pushed wide',
    GOAL: 'GOAL!',
    SAVED_CAUGHT: 'caught by the keeper',
    SAVED_PARRIED: 'parried by the keeper',
    BLOCKED: 'blocked',
    OFF_TARGET: 'off target',
    WOODWORK: 'hits the woodwork!',
    WON: 'wins the ball',
    HELD: 'holds it up',
    CLEARED: 'cleared',
    MISKICK: 'miskicked',
    YELLOW: 'yellow card',
    RED: 'red card',
    CLAIMED: 'claimed',
  },
  passTo: (from, to) => `${from} → ${to}`,
  kickOff: 'Kick-off',
  secondHalf: 'Second half',
  legend: 'Gold — you',
  orders: {
    title: 'Instructions',
    effort: 'Effort',
    mentality: 'Mentality',
    confidence: 'Confidence',
    levels: { effort: ['Save energy', 'Normal', 'All out'], mentality: ['Defensive', 'Balanced', 'Attacking'], confidence: ['Careful', 'Normal', 'Bold'] },
    hints: {
      effort: ['Saves energy, tires less', 'As usual', 'Plays stronger, but tires faster'],
      mentality: ['Helps the defence more, shoots less', 'As usual', "More shots and attacks, doesn't track back"],
      confidence: ['Safe passes, fewer take-ons', 'As usual', 'Takes players on and runs past them more'],
    },
    given: (m) => `In force from minute ${m}`,
    offPitch: "You're not on the pitch",
  },
  tabs: { events: 'Events', lineups: 'Bench' },
  stats: { possession: 'Possession', shots: 'Shots', onTarget: 'On target' },
  starters: 'Starting XI',
  bench: 'Bench',
  cameOn: 'came on',
  sentOff: 'sent off',
};

const ru: ReplayTexts = {
  action: {
    SHORT_PASS: 'Короткий пас',
    LONG_PASS: 'Длинный пас',
    THROUGH_BALL: 'Пас на ход',
    CROSS: 'Навес',
    DRIBBLE: 'Обводка',
    KNOCK_AND_RUN: 'Прокидка на скорости',
    CARRY: 'Проход с мячом',
    SHOOT: 'Удар',
    HOLD_UP: 'Удержание мяча',
    CLEAR: 'Вынос',
    BACK_PASS: 'Пас назад',
    TACKLE: 'Отбор',
    HEADER: 'Удар головой',
    LOOSE_BALL: 'Борьба за мяч',
    KICK_OFF: 'Начальный удар',
    THROW_IN: 'Аут',
    CORNER: 'Угловой',
    FREE_KICK: 'Штрафной',
    PENALTY: 'Пенальти',
    GOAL_KICK: 'Удар от ворот',
    FOUL: 'Фол',
    SUB: 'Замена',
    GK_CLAIM: 'Вратарь забирает',
  },
  outcome: {
    COMPLETE: 'точно',
    LOOSE_KEPT: 'с трудом принял',
    LOOSE_LOST: 'не справился с мячом',
    INTERCEPTED: 'перехват',
    OUT: 'в аут',
    BEAT: 'прошёл!',
    LOST: 'потеря',
    FOUL_WON: 'нарушение',
    PUSHED_WIDE: 'оттеснён к бровке',
    GOAL: 'ГОЛ!',
    SAVED_CAUGHT: 'вратарь поймал',
    SAVED_PARRIED: 'вратарь отбил',
    BLOCKED: 'заблокирован',
    OFF_TARGET: 'мимо ворот',
    WOODWORK: 'в штангу!',
    WON: 'забрал мяч',
    HELD: 'удержал',
    CLEARED: 'вынесли',
    MISKICK: 'неудачный вынос',
    YELLOW: 'жёлтая карточка',
    RED: 'красная карточка',
    CLAIMED: 'забрал',
  },
  passTo: (from, to) => `${from} → ${to}`,
  kickOff: 'Начало матча',
  secondHalf: 'Второй тайм',
  legend: 'Золотой — вы',
  orders: {
    title: 'Указания',
    effort: 'Усилия',
    mentality: 'Настрой',
    confidence: 'Уверенность',
    levels: { effort: ['Экономно', 'Обычно', 'На максимум'], mentality: ['Оборона', 'Баланс', 'Атака'], confidence: ['Осторожно', 'Обычно', 'Смело'] },
    hints: {
      effort: ['Бережёт силы, меньше устаёт', 'Как обычно', 'Играет сильнее, но быстрее устаёт'],
      mentality: ['Больше помогает защите, реже бьёт', 'Как обычно', 'Больше ударов и атак, не возвращается в защиту'],
      confidence: ['Надёжный пас, меньше обводок', 'Как обычно', 'Чаще обводит и убегает на скорости'],
    },
    given: (m) => `Действует с ${m}-й минуты`,
    offPitch: 'Вас нет на поле',
  },
  tabs: { events: 'События', lineups: 'Запасные' },
  stats: { possession: 'Владение', shots: 'Удары', onTarget: 'В створ' },
  starters: 'Основной состав',
  bench: 'Запасные',
  cameOn: 'вышел на замену',
  sentOff: 'удалён',
};

const TEXTS: Record<Lang, ReplayTexts> = { uz, en, ru };
export const replayTexts = (): ReplayTexts => TEXTS[lang];
export { TEXTS as REPLAY_TEXTS };
