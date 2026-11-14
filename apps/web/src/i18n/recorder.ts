/** Texts of the admin-only video recorder, in Uzbek, English and Russian. */
import { lang, type Lang } from './index';

export interface RecorderTexts {
  tab: string;
  intro: string;
  settings: string;
  quality: string;
  fps: string;
  bitrate: (mbps: number) => string;
  aspect: string;
  aspects: Record<'9:16' | '16:9' | '1:1', string>;
  sound: string;
  mic: string;
  watermark: string;
  watermarkOpacity: (pct: number) => string;
  endCard: string;
  hero: string;
  heroName: string;
  heroFromSave: string;
  gender: Record<'male' | 'female', string>;
  recordIntro: string;
  recordIntroNote: string;
  recordScreen: string;
  recordScreenNote: string;
  phoneWindow: string;
  phoneWindowNote: string;
  shortcuts: string;
  pause: string;
  resume: string;
  stop: string;
  rec: string;
  paused: string;
  finishing: string;
  preview: string;
  download: string;
  again: string;
  close: string;
  info: (format: string, sizeMb: string, seconds: number) => string;
  notSupported: string;
  noScreen: string;
  cancelled: string;
  overlayVisible: string;
  mp4Tip: string;
  recordMatch: string;
  recordMatchNote: string;
  share: string;
  shareHint: string;
  fabTitle: string;
  fabNoSource: string;
  matchHint: string;
  pickMatch: string;
  noMatches: string;
  matchLabel: (week: number, home: string, score: string, away: string) => string;
}

const uz: RecorderTexts = {
  tab: 'Video yozish',
  intro:
    "Reels, TikTok, Shorts va Telegram uchun video yozing. Introni to'g'ridan-to'g'ri yozsa bo'ladi (eng toza sifat), yoki o'yinning istalgan ekranini.",
  settings: 'Sozlamalar',
  quality: 'Sifat',
  fps: 'Kadr tezligi',
  bitrate: (m) => `Bitreyt: ${m} Mbit/s`,
  aspect: 'Format',
  aspects: { '9:16': '9:16 Reels/TikTok', '16:9': '16:9 YouTube', '1:1': '1:1 Kvadrat' },
  sound: "O'yin ovozi",
  mic: 'Mikrofon',
  watermark: 'Logotip (burchakda)',
  watermarkOpacity: (p) => `Shaffoflik: ${p}%`,
  endCard: "Oxirida «Hoziroq o'yna» kartasi",
  hero: 'Intro qahramoni',
  heroName: 'Ismi',
  heroFromSave: "Saqlangan o'yindagi futbolchi ko'rinishi ishlatiladi",
  gender: { male: "O'g'il bola", female: 'Qiz bola' },
  recordIntro: '🎬 Introni yozib olish',
  recordIntroNote: "Interfeyssiz, toza kadr, ovozi bilan. Oxirida o'zi to'xtaydi.",
  recordScreen: '🖥️ Ekranni yozib olish',
  recordScreenNote: "Chrome so'raganda «Shu tab»ni tanlang. Keyin o'yinga qayting va o'ynang.",
  phoneWindow: '📱 Telefon oynasini ochish (9:16)',
  phoneWindowNote: "O'yin telefon o'lchamidagi oynada ochiladi. U yerda Alt+Shift+R bilan yozing.",
  shortcuts: 'Tugmalar: Alt+Shift+R — boshlash/to\'xtatish, Alt+Shift+P — pauza.',
  pause: '⏸ Pauza',
  resume: '▶ Davom',
  stop: '⏹ Stop',
  rec: 'YOZILMOQDA',
  paused: 'PAUZA',
  finishing: 'Yakunlanmoqda...',
  preview: "Yozuvni ko'rib chiqing",
  download: '⬇ Yuklab olish',
  again: '🔁 Qayta yozish',
  close: 'Yopish',
  info: (f, mb, s) => `${f} · ${mb} MB · ${s} soniya`,
  notSupported: "Bu brauzer video yozishni qo'llamaydi. Kompyuterda Chrome yoki Edge'dan foydalaning.",
  noScreen: "Ekranni yozish faqat kompyuterdagi Chrome yoki Edge'da ishlaydi.",
  cancelled: 'Yozish bekor qilindi.',
  overlayVisible: "Diqqat: bu brauzerda qizil indikator videoga tushishi mumkin (Chrome 132+ da yashiriladi).",
  mp4Tip: "Brauzer MP4 yozmadi, WebM chiqdi. Telegram va YouTube WebM'ni qabul qiladi; Instagram uchun MP4 ga o'tkazing.",
  recordMatch: "⚽ O'yinni yozish",
  recordMatchNote: "Maydon, hisob va izohlar toza kadrda. Telefonda ham ishlaydi.",
  share: '📲 Galereyaga saqlash',
  shareHint: "Telefonda: «Galereyaga saqlash» → «Videoni saqlash» (iPhone) yoki Galereya/Google Foto (Android).",
  fabTitle: 'Video yozish',
  fabNoSource: "Telefonda o'yin (match) va intro yoziladi. Boshqa ekranlar uchun telefonning o'zidagi ekran yozish funksiyasidan foydalaning.",
  matchHint: "Ro'yxatdan o'yinni tanlang — u shu yerda ochiladi va toza kadrda yoziladi.",
  pickMatch: "O'yinni tanlang",
  noMatches: "Bu brauzerda hali o'ynalgan o'yin yo'q. Avval o'yinda bir hafta o'ynang.",
  matchLabel: (w, h, sc, a) => `${w}-hafta: ${h} ${sc} ${a}`,
};

const en: RecorderTexts = {
  tab: 'Record video',
  intro: 'Record videos for Reels, TikTok, Shorts and Telegram. Record the intro directly (cleanest quality) or any screen of the game.',
  settings: 'Settings',
  quality: 'Quality',
  fps: 'Frame rate',
  bitrate: (m) => `Bitrate: ${m} Mbit/s`,
  aspect: 'Format',
  aspects: { '9:16': '9:16 Reels/TikTok', '16:9': '16:9 YouTube', '1:1': '1:1 Square' },
  sound: 'Game sound',
  mic: 'Microphone',
  watermark: 'Logo (corner)',
  watermarkOpacity: (p) => `Opacity: ${p}%`,
  endCard: '"Play now" card at the end',
  hero: 'Intro hero',
  heroName: 'Name',
  heroFromSave: "Uses the look of the saved game's player",
  gender: { male: 'Boy', female: 'Girl' },
  recordIntro: '🎬 Record the intro',
  recordIntroNote: 'No interface, a clean frame, with sound. Stops by itself at the end.',
  recordScreen: '🖥️ Record the screen',
  recordScreenNote: 'When Chrome asks, choose "This tab". Then go back to the game and play.',
  phoneWindow: '📱 Open a phone window (9:16)',
  phoneWindowNote: 'Opens the game in a phone-sized window. Record there with Alt+Shift+R.',
  shortcuts: 'Keys: Alt+Shift+R — start/stop, Alt+Shift+P — pause.',
  pause: '⏸ Pause',
  resume: '▶ Resume',
  stop: '⏹ Stop',
  rec: 'REC',
  paused: 'PAUSED',
  finishing: 'Finishing...',
  preview: 'Check the recording',
  download: '⬇ Download',
  again: '🔁 Record again',
  close: 'Close',
  info: (f, mb, s) => `${f} · ${mb} MB · ${s} s`,
  notSupported: 'This browser cannot record video. Use Chrome or Edge on a computer.',
  noScreen: 'Screen recording works only in Chrome or Edge on a computer.',
  cancelled: 'Recording cancelled.',
  overlayVisible: 'Note: in this browser the red indicator may show in the video (Chrome 132+ hides it).',
  mp4Tip: 'The browser recorded WebM, not MP4. Telegram and YouTube accept WebM; convert to MP4 for Instagram.',
  recordMatch: '⚽ Record the match',
  recordMatchNote: 'The pitch, score and commentary in a clean frame. Works on phones too.',
  share: '📲 Save to gallery',
  shareHint: 'On a phone: "Save to gallery" → "Save Video" (iPhone) or Gallery/Google Photos (Android).',
  fabTitle: 'Record video',
  fabNoSource: "On phones you can record matches and the intro. For other screens use the phone's own screen recorder.",
  matchHint: 'Pick a match from the list — it opens here and is recorded in a clean frame.',
  pickMatch: 'Choose a match',
  noMatches: 'No matches played in this browser yet. Play a week in the game first.',
  matchLabel: (w, h, sc, a) => `Week ${w}: ${h} ${sc} ${a}`,
};

const ru: RecorderTexts = {
  tab: 'Запись видео',
  intro: 'Записывайте видео для Reels, TikTok, Shorts и Telegram. Интро пишется напрямую (самое чистое качество), или любой экран игры.',
  settings: 'Настройки',
  quality: 'Качество',
  fps: 'Частота кадров',
  bitrate: (m) => `Битрейт: ${m} Мбит/с`,
  aspect: 'Формат',
  aspects: { '9:16': '9:16 Reels/TikTok', '16:9': '16:9 YouTube', '1:1': '1:1 Квадрат' },
  sound: 'Звук игры',
  mic: 'Микрофон',
  watermark: 'Логотип (в углу)',
  watermarkOpacity: (p) => `Прозрачность: ${p}%`,
  endCard: 'Карточка «Играй сейчас» в конце',
  hero: 'Герой интро',
  heroName: 'Имя',
  heroFromSave: 'Используется внешность игрока из сохранения',
  gender: { male: 'Парень', female: 'Девушка' },
  recordIntro: '🎬 Записать интро',
  recordIntroNote: 'Без интерфейса, чистый кадр, со звуком. Останавливается само в конце.',
  recordScreen: '🖥️ Записать экран',
  recordScreenNote: 'Когда Chrome спросит, выберите «Эта вкладка». Затем вернитесь в игру и играйте.',
  phoneWindow: '📱 Открыть окно телефона (9:16)',
  phoneWindowNote: 'Игра откроется в окне размера телефона. Записывайте там через Alt+Shift+R.',
  shortcuts: 'Клавиши: Alt+Shift+R — старт/стоп, Alt+Shift+P — пауза.',
  pause: '⏸ Пауза',
  resume: '▶ Дальше',
  stop: '⏹ Стоп',
  rec: 'ЗАПИСЬ',
  paused: 'ПАУЗА',
  finishing: 'Завершаем...',
  preview: 'Проверьте запись',
  download: '⬇ Скачать',
  again: '🔁 Записать заново',
  close: 'Закрыть',
  info: (f, mb, s) => `${f} · ${mb} МБ · ${s} с`,
  notSupported: 'Этот браузер не умеет записывать видео. Используйте Chrome или Edge на компьютере.',
  noScreen: 'Запись экрана работает только в Chrome или Edge на компьютере.',
  cancelled: 'Запись отменена.',
  overlayVisible: 'Внимание: в этом браузере красный индикатор может попасть в видео (Chrome 132+ его скрывает).',
  mp4Tip: 'Браузер записал WebM, а не MP4. Telegram и YouTube принимают WebM; для Instagram конвертируйте в MP4.',
  recordMatch: '⚽ Записать матч',
  recordMatchNote: 'Поле, счёт и комментарии в чистом кадре. Работает и на телефоне.',
  share: '📲 Сохранить в галерею',
  shareHint: 'На телефоне: «Сохранить в галерею» → «Сохранить видео» (iPhone) или Галерея/Google Фото (Android).',
  fabTitle: 'Запись видео',
  fabNoSource: 'На телефоне записываются матчи и интро. Для других экранов используйте встроенную запись экрана телефона.',
  matchHint: 'Выберите матч из списка — он откроется здесь и запишется в чистом кадре.',
  pickMatch: 'Выберите матч',
  noMatches: 'В этом браузере ещё нет сыгранных матчей. Сначала сыграйте неделю в игре.',
  matchLabel: (w, h, sc, a) => `Неделя ${w}: ${h} ${sc} ${a}`,
};

const TEXTS: Record<Lang, RecorderTexts> = { uz, en, ru };
export const recTexts = (): RecorderTexts => TEXTS[lang];
export { TEXTS as RECORDER_TEXTS };
