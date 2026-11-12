/**
 * All UI text (Uzbek, Latin script). Code identifiers stay in English.
 * Keep every user-facing string here so a second language can be added later.
 */
import type { MatchEventType, PersonaRole, Position, SeasonOutcome, StatKey, TrainingId } from '@futbolchi/engine';

export const uz = {
  appName: 'Futbolchi Pro',
  tagline: "Bolalikdagi orzuingiz — endi sizning karyerangiz.",
  start: 'Karyerani boshlash',
  continue: 'Davom etish',
  newCareer: 'Yangi karyera',
  confirmNewCareer: "Joriy karyera o'chiriladi. Davom etasizmi?",
  back: 'Orqaga',
  loading: 'Yuklanmoqda…',

  positions: {
    GK: 'Darvozabon',
    CB: 'Markaziy himoyachi',
    FB: 'Qanot himoyachisi',
    CM: 'Yarim himoyachi',
    W: 'Qanot hujumchisi',
    ST: 'Hujumchi',
  } satisfies Record<Position, string>,

  stats: {
    pace: 'Tezlik',
    shooting: 'Zarba',
    passing: 'Pas',
    dribbling: 'Dribling',
    defending: 'Himoya',
    physical: 'Jismoniy kuch',
    mentality: 'Ruhiyat',
  } satisfies Record<StatKey, string>,

  // Persona creation
  createTitle: 'Futbolchingizni yarating',
  nameLabel: 'Ism',
  namePlaceholder: 'Masalan: Aziz',
  positionLabel: 'Pozitsiya',
  bonusLabel: (left: number) => `Qo'shimcha ochkolar: ${left} ta qoldi`,
  createButton: 'Akademiyaga qadam qo\'yish',
  errors: {
    name_length: "Ism 2 dan 24 gacha belgidan iborat bo'lishi kerak.",
    bad_position: 'Pozitsiyani tanlang.',
    bonus_negative: "Ochkolar manfiy bo'lishi mumkin emas.",
    bonus_per_stat: "Bitta ko'rsatkichga 5 tadan ortiq ochko berib bo'lmaydi.",
    bonus_total: "Ochkolar yetarli emas.",
  } as Record<string, string>,

  // Payment (mock)
  payTitle: 'Persona yaratish',
  payText: "Har bir futbolchi — alohida orzu. Persona yaratish pullik xizmat.",
  payPrice: (amount: string) => `Narxi: ${amount}`,
  payButton: "To'lash",
  payMockNotice: "Sinov rejimi: haqiqiy pul yechilmaydi.",
  payConfirm: "To'lovni tasdiqlash",
  payDecline: 'Bekor qilish',
  payWaiting: "To'lov tekshirilmoqda…",
  payDone: "To'lov qabul qilindi! Endi futbolchingizni yarating.",
  payFailed: "To'lov amalga oshmadi. Qaytadan urinib ko'ring.",
  serverDown: "Server bilan aloqa yo'q. Serverni ishga tushiring (npm run dev:server).",
  receipt: (id: string) => `Chek raqami: ${id}`,

  // Week / training
  seasonWeek: (season: number, week: number, total: number) => `${season}-mavsum · ${week}/${total}-hafta`,
  ovr: 'Umumiy reyting',
  age: (n: number) => `${n} yosh`,
  fatigue: 'Charchoq',
  injured: (w: number) => `Jarohat: yana ${w} hafta`,
  trainingTitle: 'Bu haftaning mashg\'uloti',
  trainingHint: "Bittasini tanlang. O'yin avtomatik o'tadi.",
  playWeek: "Mashg'ulot va o'yin",
  trainingNames: {
    shooting: 'Zarba mashqi',
    gym: 'Kuch zali',
    tactical: "Taktik mashg'ulot",
    speed: 'Tezlik mashqi',
    passing: 'Pas rondosi',
    dribbling: 'Dribling mashqi',
    defending: "Himoya chizig'i",
    rest: 'Dam olish',
  } satisfies Record<TrainingId, string>,
  effFatigue: (n: number) => (n >= 0 ? `Charchoq +${n}` : `Charchoq ${n}`),
  effInjury: (pct: number) => `Jarohat xavfi +${pct}%`,
  effNoGrowth: "O'sish yo'q",
  table: 'Turnir jadvali',
  tableCols: { pos: '#', club: 'Klub', p: "O'", gd: 'TF', pts: 'O' },
  nextMatch: (home: string, away: string) => `Keyingi o'yin: ${home} — ${away}`,
  career: 'Karyera',
  careerLine: (apps: number, goals: number, assists: number) => `${apps} o'yin · ${goals} gol · ${assists} golli pas`,

  // Match
  matchTitle: (week: number) => `${week}-hafta o'yini`,
  roles: {
    start: 'Asosiy tarkibda',
    sub: "Zaxiradan chiqdi",
    bench: "Zaxirada qoldi",
    injured: 'Jarohat sababli o\'ynamadi',
  } satisfies Record<PersonaRole, string>,
  play: "Ko'rish",
  pause: 'Pauza',
  skip: 'Oxiriga',
  speed: 'Tezlik',
  rating: 'Reyting',
  noEvents: "Bu o'yinda muhim voqealar bo'lmadi.",
  afterMatch: 'Davom etish',
  fullTime: "O'yin tugadi",
  personaLine: (min: number, g: number, a: number) => `${min} daqiqa · ${g} gol · ${a} golli pas`,
  eventIcons: {
    goal: '⚽',
    keyChance: '🎯',
    save: '🧤',
    card: '🟨',
    injury: '🩹',
    substitution: '🔁',
  } satisfies Record<MatchEventType, string>,

  // Summary
  summaryTitle: (n: number) => `${n}-mavsum yakunlari`,
  outcomes: {
    promoted: "Ko'tarildi!",
    relegated: 'Quyi ligaga tushdi',
    stayed: 'Ligada qoldi',
  } satisfies Record<SeasonOutcome, string>,
  finalPosition: (n: number) => `${n}-o'rin`,
  sumApps: "O'yinlar",
  sumGoals: 'Gollar',
  sumAssists: 'Golli paslar',
  sumSaves: 'Seyvlar',
  sumRating: "O'rtacha reyting",
  transferTitle: 'Transfer takliflari',
  transferText: "Sizning o'yiningiz e'tibordan chetda qolmadi. Qayerda o'ynaysiz?",
  transferAccept: (club: string) => `${club}ga o'tish`,
  stay: (club: string) => `${club}da qolish`,
  nextSeason: 'Keyingi mavsum',
  share: 'Ulashish',
  downloadCard: 'Rasmni yuklab olish',
  shareText: (name: string) => `${name} — Futbolchi Pro karyerasi`,

  // Admin
  adminTitle: 'Admin: highlightlar',
  adminToken: 'Admin token',
  adminLoad: 'Yuklash',
  adminMatches: "O'yinlar",
  adminSave: 'Highlightlarni saqlash',
  adminSaved: 'Saqlandi',
  adminNoMatches: "Hali o'yinlar yo'q. Avval o'yinda bir necha hafta o'ynang.",
};

export type Uz = typeof uz;
