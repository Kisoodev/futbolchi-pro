/**
 * The intro film's script in Uzbek, English and Russian. Every line is a
 * function of the hero's name and gender, so words like "o'g'lim / qizim",
 * "son / daughter" and Russian verb endings fit the player's persona.
 */
import type { Gender } from '@futbolchi/engine';
import { lang, type Lang } from './index';

export interface IntroVars {
  name: string;
  g: Gender;
}

export type IntroLineKey =
  | 'place'
  | 'night'
  | 'dream'
  | 'heroAsk'
  | 'dad1'
  | 'dad2'
  | 'mom1'
  | 'heroHurt'
  | 'doubt'
  | 'prove'
  | 'momGift'
  | 'momFather'
  | 'academy'
  | 'kidLaugh'
  | 'promise'
  | 'coachStop'
  | 'coachAsk'
  | 'heroAnswer'
  | 'coachIntro'
  | 'coachVerdict'
  | 'tagline';

export interface IntroScript {
  lines: Record<IntroLineKey, (v: IntroVars) => string>;
  /** Text on the phone screen (short lines). */
  phone: string[];
  /** Sign over the academy gate. */
  academySign: string;
  /** Speaker labels shown above a line. */
  /** Hero and minor speakers; story characters' labels come from characters/. */
  who: { hero: (v: IntroVars) => string; kid: string };
  skip: string;
  loading: string;
  /** End card in recorded videos. */
  playNow: string;
}

const uz: IntroScript = {
  lines: {
    place: ({ name }) => `${name}, 17 yosh. Oddiy bir qishloq.`,
    night: () => "Hamma uxlagan. Faqat to'p uyg'oq.",
    dream: () => "Futbol akademiyasi saralash o'tkazmoqda... Bu mening imkoniyatim.",
    heroAsk: () => "Dada... men futbolchi bo'lmoqchiman. Akademiyaga boraman.",
    dad1: ({ g }) => `Futbol — o'yin, ${g === 'female' ? 'qizim' : "o'g'lim"}. Hayot esa boshqa narsa.`,
    dad2: () => "Mingta boladan bittasi yetib boradi. Jarohat, o'qish... Keyin pushaymon bo'lasan.",
    mom1: () => 'Otang seni o\'ylayapti, bolam...',
    heroHurt: () => "Axir mening orzuim — mashhur futbolchi bo'lish!",
    doubt: () => 'Balki dadam haqdir...',
    prove: () => "Yo'q. Isbotlab beraman.",
    momGift: () => "Mana, yo'l puli. O'zingni ehtiyot qil, bolam.",
    momFather: () => "Otang kuzatgani chiqmadi... hali ham xafa. Lekin men senga ishonaman.",
    academy: () => 'Saralash kuni.',
    kidLaugh: ({ g }) => `Bu ${g === 'female' ? 'qiz' : 'bola'} qayerdan keldi? Ha-ha!`,
    promise: () => "Endi bu faqat orzu emas. Bu — va'da.",
    coachStop: () => 'Kulishni bas qiling. Maydonda gapni oyoq gapiradi.',
    coachAsk: () => 'Isming nima?',
    heroAnswer: ({ name }) => `${name}.`,
    coachIntro: () => "Men Rustam Sobirov, akademiya murabbiyi. Qani, ko'rsat-chi, nimaga qodirsan.",
    coachVerdict: () => 'Yomon emas. Lekin bu faqat boshlanishi. Bugundan men bilan ishlaysan — har haftani birga rejalashtiramiz.',
    tagline: () => 'Karyerang shu yerdan boshlanadi.',
  },
  phone: ['FUTBOL', 'AKADEMIYASI', 'Saralash:', 'shanba 9:00'],
  academySign: 'FUTBOL AKADEMIYASI',
  who: { hero: ({ name }) => name, kid: 'Akademiya bolasi' },
  skip: "O'tkazib yuborish ⏭",
  loading: 'Sahna tayyorlanmoqda...',
  playNow: "Hoziroq o'yna",
};

const en: IntroScript = {
  lines: {
    place: ({ name }) => `${name}, 17. A small village.`,
    night: () => 'Everyone is asleep. Only the ball is awake.',
    dream: () => 'The football academy is holding trials... This is my chance.',
    heroAsk: () => "Dad... I want to be a footballer. I'm going to the academy.",
    dad1: ({ g }) => `Football is a game, ${g === 'female' ? 'my girl' : 'son'}. Life is something else.`,
    dad2: () => "One kid in a thousand makes it. Injuries, school... You'll regret it.",
    mom1: () => 'Your father is thinking of you, dear...',
    heroHurt: () => 'But my dream is to become a famous footballer!',
    doubt: () => 'Maybe Dad is right...',
    prove: () => "No. I'll prove it.",
    momGift: () => 'Here, money for the road. Take care of yourself, dear.',
    momFather: () => "Your father didn't come out... he's still upset. But I believe in you.",
    academy: () => 'Trial day.',
    kidLaugh: ({ g }) => `Where did ${g === 'female' ? 'she' : 'he'} come from? Ha-ha!`,
    promise: () => "It's not just a dream anymore. It's a promise.",
    coachStop: () => 'Stop laughing. On the pitch, feet do the talking.',
    coachAsk: () => "What's your name?",
    heroAnswer: ({ name }) => `${name}.`,
    coachIntro: () => "I'm Rustam Sobirov, the academy coach. Go on — show me what you've got.",
    coachVerdict: () => "Not bad. But this is only the start. From today you work with me — we'll plan every week together.",
    tagline: () => 'Your career starts here.',
  },
  phone: ['FOOTBALL', 'ACADEMY', 'Trials:', 'Sat 9:00'],
  academySign: 'FOOTBALL ACADEMY',
  who: { hero: ({ name }) => name, kid: 'Academy kid' },
  skip: 'Skip ⏭',
  loading: 'Setting the scene...',
  playNow: 'Play now',
};

const ru: IntroScript = {
  lines: {
    place: ({ name }) => `${name}, 17 лет. Обычная деревня.`,
    night: () => 'Все спят. Не спит только мяч.',
    dream: () => 'Футбольная академия проводит отбор... Это мой шанс.',
    heroAsk: ({ g }) => `Папа... я хочу стать ${g === 'female' ? 'футболисткой' : 'футболистом'}. Я пойду в академию.`,
    dad1: ({ g }) => `Футбол — это игра, ${g === 'female' ? 'дочка' : 'сынок'}. А жизнь — другое.`,
    dad2: () => 'Из тысячи доходит один. Травмы, учёба... Потом пожалеешь.',
    mom1: () => 'Отец думает о тебе, родной...',
    heroHurt: ({ g }) => `Но моя мечта — стать ${g === 'female' ? 'известной футболисткой' : 'известным футболистом'}!`,
    doubt: () => 'Может, папа прав...',
    prove: () => 'Нет. Я докажу.',
    momGift: () => 'Вот, деньги на дорогу. Береги себя, родной.',
    momFather: () => 'Отец не вышел проводить... он всё ещё обижен. Но я в тебя верю.',
    academy: () => 'День отбора.',
    kidLaugh: ({ g }) => `${g === 'female' ? 'Откуда она взялась' : 'Откуда он взялся'}? Ха-ха!`,
    promise: () => 'Это уже не просто мечта. Это обещание.',
    coachStop: () => 'Хватит смеяться. На поле говорят ноги.',
    coachAsk: () => 'Как тебя зовут?',
    heroAnswer: ({ name }) => `${name}.`,
    coachIntro: ({ g }) => `Я Рустам Собиров, тренер академии. Ну-ка, покажи, на что ты ${g === 'female' ? 'способна' : 'способен'}.`,
    coachVerdict: () => 'Неплохо. Но это только начало. С сегодняшнего дня работаешь со мной — каждую неделю планируем вместе.',
    tagline: () => 'Твоя карьера начинается здесь.',
  },
  phone: ['ФУТБОЛЬНАЯ', 'АКАДЕМИЯ', 'Отбор:', 'сб 9:00'],
  academySign: 'ФУТБОЛЬНАЯ АКАДЕМИЯ',
  who: { hero: ({ name }) => name, kid: 'Игрок академии' },
  skip: 'Пропустить ⏭',
  loading: 'Готовим сцену...',
  playNow: 'Играй сейчас',
};

const SCRIPTS: Record<Lang, IntroScript> = { uz, en, ru };

/** The script in the current language. */
export const introScript = (): IntroScript => SCRIPTS[lang];
export { SCRIPTS as INTRO_SCRIPTS };
