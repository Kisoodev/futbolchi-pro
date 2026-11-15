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
  | 'kidPraise'
  | 'promise'
  | 'coachPresent'
  | 'silence'
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
    kidPraise: () => "Odil, bunisi zo'r-ku! Agentlar bekorga kelmayapti!",
    promise: () => "Endi bu faqat orzu emas. Bu — va'da.",
    coachPresent: ({ name }) => `Diqqat. Bu — ${name}. Bugundan biz bilan.`,
    silence: () => "Hech kim hech narsa demadi. Hamma Odilga qarab turardi.",
    coachIntro: () => "Men Kapadze, akademiya murabbiyi. Orzu qilish bepul. Bu yerdagi joy esa qimmat. Ko'rsat.",
    coachVerdict: () => "Yomon emas. Yetarli ham emas. Ertadan men bilan ishlaysan. Maydon yolg'on gapirmaydi.",
    tagline: () => 'Karyerang shu yerdan boshlanadi.',
  },
  phone: ['ETIQOD', 'AKADEMIYASI', 'Saralash:', 'shanba 9:00'],
  academySign: 'ETIQOD AKADEMIYASI',
  who: { hero: ({ name }) => name, kid: 'Doniyor' },
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
    kidPraise: () => "Odil, that was unreal! No wonder the agents keep coming!",
    promise: () => "It's not just a dream anymore. It's a promise.",
    coachPresent: ({ name }) => `Listen up. This is ${name}. With us from today.`,
    silence: () => 'Nobody said a word. Everyone kept watching Odil.',
    coachIntro: () => "I'm Kapadze, the academy coach. Dreaming is free. A place here is not. Show me.",
    coachVerdict: () => "Not bad. Not enough, either. From tomorrow you work with me. The pitch doesn't lie.",
    tagline: () => 'Your career starts here.',
  },
  phone: ['ETIQOD', 'ACADEMY', 'Trials:', 'Sat 9:00'],
  academySign: 'ETIQOD FOOTBALL ACADEMY',
  who: { hero: ({ name }) => name, kid: 'Doniyor' },
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
    kidPraise: () => 'Одил, это было нечто! Не зря агенты приезжают!',
    promise: () => 'Это уже не просто мечта. Это обещание.',
    coachPresent: ({ name }) => `Внимание. Это ${name}. С сегодняшнего дня с нами.`,
    silence: () => 'Никто ничего не сказал. Все смотрели на Одила.',
    coachIntro: () => 'Я Кападзе, тренер академии. Мечтать — бесплатно. А место здесь стоит дорого. Покажи.',
    coachVerdict: () => 'Неплохо. Но и недостаточно. С завтрашнего дня работаешь со мной. Поле не врёт.',
    tagline: () => 'Твоя карьера начинается здесь.',
  },
  phone: ['АКАДЕМИЯ', '«ЭТИКОД»', 'Отбор:', 'сб 9:00'],
  academySign: 'АКАДЕМИЯ «ЭТИКОД»',
  who: { hero: ({ name }) => name, kid: 'Дониёр' },
  skip: 'Пропустить ⏭',
  loading: 'Готовим сцену...',
  playNow: 'Играй сейчас',
};

const SCRIPTS: Record<Lang, IntroScript> = { uz, en, ru };

/** The script in the current language. */
export const introScript = (): IntroScript => SCRIPTS[lang];
export { SCRIPTS as INTRO_SCRIPTS };
