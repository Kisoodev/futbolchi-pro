/**
 * The in-game coach's lessons in Uzbek, English and Russian. Each lesson is a
 * list of steps; a step may point at a part of the screen (CSS selectors, the
 * first visible one is used) and, on phones, switch the week tab first.
 * Steps whose target is not on screen are skipped.
 */
import type { Gender } from '@futbolchi/engine';
import { lang, type Lang } from './index';

export type LessonId = 'week' | 'matchDay' | 'match' | 'summary';
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
      { text: ({ name }) => `${name}. Men Usmoxan Kapadze. Bu yerda hamma meni shunchaki Kapadze deydi. Bir marta tushuntiraman — eshit.`, view: 'train' },
      { text: () => "Bu sening kartang: pozitsiya, klub, OVR — umumiy reyting va jadvaldagi o'rning. Chiziq — charchoq: qizarsa, dam ber.", target: CARD, view: 'train' },
      { text: () => "Bu haftaning o'yini: raqib, uyda yoki mehmonda va oxirgi natijalar (G — g'alaba, D — durang, M — mag'lubiyat).", target: ['.fixture'], view: 'train' },
      { text: () => "Mashg'ulot kunida uchta mashg'ulotdan bittasini tanlaysan. ▲ — u qaysi ko'rsatkichni kuchaytiradi; pastda — qanchalik charchatadi va jarohat xavfi bormi.", target: ['.options'], view: 'train' },
      { text: () => "Tanlagach, shu tugmani bos: ko'rsatkichlaring o'sadi. Ertasi kuni — o'yin kuni: yaxshi o'ynasang, asosiy ko'rsatkichlaring yana o'sadi.", target: ['.play-btn'], view: 'train' },
      { text: () => 'Bu jadval. Mavsum oxirida birinchi 2 ta jamoa yuqori ligaga chiqadi. Maqsadimiz — eng yuqori liga!', target: ['.table-card'], view: 'table' },
      { text: () => "Pastdagi tugmalar: «Futbolchi» — ko'rsatkichlaring, «Mashg'ulot» va «Jadval».", target: ['.m-tabs'], view: 'train' },
      { text: () => "Hammasi shu. Maydon yolg'on gapirmaydi. Birinchi mashg'ulotni tanla.", view: 'train' },
    ],
    matchDay: [
      { text: () => "Bugun o'yin kuni! Kecha mashg'ulot qilding — endi maydonda ko'rsat. Yaxshi o'ynasang, ko'proq o'sasan.", target: ['.match-day'], view: 'train' },
      { text: () => "Bu sening akkaunt darajang. Mashg'ulot, o'yin, g'alaba va missiyalar uchun XP olasan. Bosib, missiyalarni ko'r.", target: ['.account-badge'] },
      { text: () => "Tayyormisan? «O'yinga chiqish»ni bos!", target: ['.play-btn'], view: 'train' },
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
      { text: ({ name }) => `${name}. I'm Usmoxan Kapadze. Here everyone just calls me Kapadze. I'll explain this once — listen.`, view: 'train' },
      { text: () => 'This is your card: position, club, OVR (overall rating) and your place in the table. The bar is fatigue: when it turns red, rest.', target: CARD, view: 'train' },
      { text: () => "This week's match: the opponent, home or away, and recent results (W — win, D — draw, L — loss).", target: ['.fixture'], view: 'train' },
      { text: () => 'On a training day you pick one of three trainings. ▲ shows what it strengthens; below — how tiring it is and whether it risks an injury.', target: ['.options'], view: 'train' },
      { text: () => 'Once you pick, press this button: your attributes grow. The next day is match day — play well and your main attributes grow again.', target: ['.play-btn'], view: 'train' },
      { text: () => "The table. At the end of the season the top 2 teams go up a league. Our goal is the top league!", target: ['.table-card'], view: 'table' },
      { text: () => 'The buttons at the bottom: "Player" for your stats, "Training" and "Table".', target: ['.m-tabs'], view: 'train' },
      { text: () => "That's all. The pitch doesn't lie. Pick your first training.", view: 'train' },
    ],
    matchDay: [
      { text: () => 'Match day! You trained yesterday — now show it on the pitch. Play well and you grow more.', target: ['.match-day'], view: 'train' },
      { text: () => 'This is your account level. You earn XP for training, matches, wins and missions. Tap it to see your missions.', target: ['.account-badge'] },
      { text: () => 'Ready? Press "Go to the match"!', target: ['.play-btn'], view: 'train' },
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
      { text: ({ name }) => `${name}. Я Усмохан Кападзе. Здесь все зовут меня просто Кападзе. Объясню один раз — слушай.`, view: 'train' },
      { text: () => 'Это твоя карточка: позиция, клуб, OVR — общий рейтинг и место в таблице. Полоска — усталость: покраснела — дай себе отдых.', target: CARD, view: 'train' },
      { text: () => 'Матч этой недели: соперник, дома или в гостях и последние результаты (В — победа, Н — ничья, П — поражение).', target: ['.fixture'], view: 'train' },
      { text: () => 'В день тренировки выбираешь одну из трёх. ▲ — что она усиливает; ниже — насколько она утомляет и есть ли риск травмы.', target: ['.options'], view: 'train' },
      { text: ({ g }) => `${g === 'female' ? 'Выбрала' : 'Выбрал'} — жми эту кнопку: показатели вырастут. На следующий день — матч: хорошая игра снова усилит главные показатели.`, target: ['.play-btn'], view: 'train' },
      { text: () => 'Это таблица. В конце сезона первые 2 команды выходят в лигу выше. Наша цель — высшая лига!', target: ['.table-card'], view: 'table' },
      { text: () => 'Кнопки внизу: «Игрок» — твои показатели, «Тренировка» и «Таблица».', target: ['.m-tabs'], view: 'train' },
      { text: () => 'Вот и всё. Поле не врёт. Выбирай первую тренировку.', view: 'train' },
    ],
    matchDay: [
      { text: () => 'День матча! Вчера была тренировка — теперь покажи себя на поле. Хорошая игра — больше роста.', target: ['.match-day'], view: 'train' },
      { text: () => 'Это уровень твоего аккаунта. XP дают за тренировки, матчи, победы и миссии. Нажми, чтобы увидеть миссии.', target: ['.account-badge'] },
      { text: () => 'Готов(а)? Жми «На матч»!', target: ['.play-btn'], view: 'train' },
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
