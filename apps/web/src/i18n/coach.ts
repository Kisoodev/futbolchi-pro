/**
 * The in-game coach's lessons in Uzbek, English and Russian. Each lesson is a
 * list of steps; a step may point at a part of the screen (CSS selectors, the
 * first visible one is used) and, on phones, switch the week tab first.
 * Steps whose target is not on screen are skipped.
 */
import type { Gender } from '@futbolchi/engine';
import { lang, type Lang } from './index';

export type LessonId = 'week' | 'match' | 'summary';
export type WeekView = 'me' | 'train' | 'table';

export interface CoachVars {
  name: string;
  g: Gender;
}

export interface CoachStep {
  text: (v: CoachVars) => string;
  target?: string[];
  view?: WeekView;
}

export interface CoachTexts {
  title: string;
  next: string;
  back: string;
  done: string;
  skip: string;
  step: (i: number, n: number) => string;
  settingsOn: string;
  settingsOff: string;
  replay: string;
  lessons: Record<LessonId, CoachStep[]>;
}

const CARD = ['.m-status', '.persona-card'];

const uz: CoachTexts = {
  title: 'Murabbiy',
  next: 'Keyingi →',
  back: '←',
  done: 'Tushunarli!',
  skip: "O'tkazib yuborish",
  step: (i, n) => `${i}/${n}`,
  settingsOn: '🧑‍🏫 Murabbiy maslahatlari: yoqilgan',
  settingsOff: "🧑‍🏫 Murabbiy maslahatlari: o'chirilgan",
  replay: "🧑‍🏫 Murabbiy darsini qayta ko'rish",
  lessons: {
    week: [
      { text: ({ name }) => `Salom, ${name}! Men Rustam Sobirov — murabbiyingman. Boshlashdan oldin o'yinni qisqacha tushuntirib beraman.`, view: 'train' },
      { text: () => "Bu sening kartang: pozitsiya, klub, OVR — umumiy reyting va jadvaldagi o'rning. Chiziq — charchoq: qizarsa, dam ber.", target: CARD, view: 'train' },
      { text: () => "Bu haftaning o'yini: raqib, uyda yoki mehmonda va oxirgi natijalar (G — g'alaba, D — durang, M — mag'lubiyat).", target: ['.fixture'], view: 'train' },
      { text: () => "Har hafta bitta mashg'ulot tanlaysan. Yashil — nima o'sadi, qizil — charchoq va jarohat xavfi. Og'ir mashq tez o'stiradi, lekin charchatadi.", target: ['.options'], view: 'train' },
      { text: () => "Tanlagach, shu tugmani bos: mashg'ulot o'tadi, o'yin esa o'zi o'ynaladi — sen kuzatasan.", target: ['.play-btn'], view: 'train' },
      { text: () => 'Bu jadval. Mavsum oxirida birinchi 2 ta jamoa yuqori ligaga chiqadi. Maqsadimiz — eng yuqori liga!', target: ['.table-card'], view: 'table' },
      { text: () => "Pastdagi tugmalar: «Futbolchi» — ko'rsatkichlaring, «Mashg'ulot» va «Jadval».", target: ['.m-tabs'], view: 'train' },
      { text: () => 'Hammasi shu. Senga ishonaman — birinchi mashg\'ulotni tanla!', view: 'train' },
    ],
    match: [
      { text: () => "Bu sening o'yining. Maydonda o'zingni ismingdan topasan — kuzat va o'rgan." },
      { text: () => "O'yin tugagach reytinging chiqadi (1–10). 7 dan yuqori — zo'r o'yin. Keyin shu tugma bilan keyingi haftaga o't.", target: ['.match-foot button'] },
    ],
    summary: [
      { text: () => 'Mavsum tugadi! Bu yerda natijalaring: o\'yinlar, gollar, assistlar va o\'rtacha reyting.', target: ['.tiles'] },
      { text: () => "Kuchliroq klub taklif qilsa, shu yerda chiqadi. Yuqori ligada raqiblar kuchliroq, lekin o'sish ham tezroq.", target: ['.transfer'] },
      { text: () => "Tayyor bo'lsang — keyingi mavsumga! Men yoningdaman.", target: ['.panel-foot .primary'] },
    ],
  },
};

const en: CoachTexts = {
  title: 'Coach',
  next: 'Next →',
  back: '←',
  done: 'Got it!',
  skip: 'Skip',
  step: (i, n) => `${i}/${n}`,
  settingsOn: "🧑‍🏫 Coach's tips: on",
  settingsOff: "🧑‍🏫 Coach's tips: off",
  replay: "🧑‍🏫 Replay the coach's lesson",
  lessons: {
    week: [
      { text: ({ name }) => `Hi, ${name}! I'm Rustam Sobirov, your coach. Before we start, let me show you how it all works.`, view: 'train' },
      { text: () => 'This is your card: position, club, OVR (overall rating) and your place in the table. The bar is fatigue: when it turns red, rest.', target: CARD, view: 'train' },
      { text: () => "This week's match: the opponent, home or away, and recent results (W — win, D — draw, L — loss).", target: ['.fixture'], view: 'train' },
      { text: () => 'Each week you pick one training. Green shows what grows, red shows fatigue and injury risk. Hard sessions grow you fast but wear you out.', target: ['.options'], view: 'train' },
      { text: () => 'Once you choose, press this button: the training happens and the match plays itself — you watch.', target: ['.play-btn'], view: 'train' },
      { text: () => "The table. At the end of the season the top 2 teams go up a league. Our goal is the top league!", target: ['.table-card'], view: 'table' },
      { text: () => 'The buttons at the bottom: "Player" for your stats, "Training" and "Table".', target: ['.m-tabs'], view: 'train' },
      { text: () => "That's it. I believe in you — pick your first training!", view: 'train' },
    ],
    match: [
      { text: () => "This is your match. Find yourself on the pitch by your name — watch and learn." },
      { text: () => 'When it ends you get a rating (1–10). Above 7 is a great game. Then use this button to go to the next week.', target: ['.match-foot button'] },
    ],
    summary: [
      { text: () => 'The season is over! Here are your numbers: games, goals, assists and average rating.', target: ['.tiles'] },
      { text: () => 'If a stronger club makes an offer, it shows here. Rivals are tougher in a higher league, but you grow faster too.', target: ['.transfer'] },
      { text: () => "When you're ready — on to the next season! I'm with you.", target: ['.panel-foot .primary'] },
    ],
  },
};

const ru: CoachTexts = {
  title: 'Тренер',
  next: 'Дальше →',
  back: '←',
  done: 'Понятно!',
  skip: 'Пропустить',
  step: (i, n) => `${i}/${n}`,
  settingsOn: '🧑‍🏫 Советы тренера: вкл',
  settingsOff: '🧑‍🏫 Советы тренера: выкл',
  replay: '🧑‍🏫 Повторить урок тренера',
  lessons: {
    week: [
      { text: ({ name }) => `Привет, ${name}! Я Рустам Собиров, твой тренер. Прежде чем начать, коротко объясню игру.`, view: 'train' },
      { text: () => 'Это твоя карточка: позиция, клуб, OVR — общий рейтинг и место в таблице. Полоска — усталость: покраснела — дай себе отдых.', target: CARD, view: 'train' },
      { text: () => 'Матч этой недели: соперник, дома или в гостях и последние результаты (В — победа, Н — ничья, П — поражение).', target: ['.fixture'], view: 'train' },
      { text: () => 'Каждую неделю выбираешь одну тренировку. Зелёное — что растёт, красное — усталость и риск травмы. Тяжёлая тренировка растит быстро, но выматывает.', target: ['.options'], view: 'train' },
      { text: ({ g }) => `${g === 'female' ? 'Выбрала' : 'Выбрал'} — жми эту кнопку: тренировка пройдёт, а матч сыграется сам, ты смотришь.`, target: ['.play-btn'], view: 'train' },
      { text: () => 'Это таблица. В конце сезона первые 2 команды выходят в лигу выше. Наша цель — высшая лига!', target: ['.table-card'], view: 'table' },
      { text: () => 'Кнопки внизу: «Игрок» — твои показатели, «Тренировка» и «Таблица».', target: ['.m-tabs'], view: 'train' },
      { text: () => 'Вот и всё. Я в тебя верю — выбирай первую тренировку!', view: 'train' },
    ],
    match: [
      { text: () => 'Это твой матч. Найди себя на поле по имени — смотри и учись.' },
      { text: () => 'После матча появится твоя оценка (1–10). Выше 7 — отличная игра. Потом этой кнопкой переходи к следующей неделе.', target: ['.match-foot button'] },
    ],
    summary: [
      { text: () => 'Сезон окончен! Здесь твои цифры: матчи, голы, передачи и средняя оценка.', target: ['.tiles'] },
      { text: () => 'Если сильный клуб сделает предложение, оно появится здесь. В лиге выше соперники сильнее, но и рост быстрее.', target: ['.transfer'] },
      { text: ({ g }) => `${g === 'female' ? 'Готова' : 'Готов'} — вперёд, в новый сезон! Я рядом.`, target: ['.panel-foot .primary'] },
    ],
  },
};

const TEXTS: Record<Lang, CoachTexts> = { uz, en, ru };
export const coachTexts = (): CoachTexts => TEXTS[lang];
export { TEXTS as COACH_TEXTS };
