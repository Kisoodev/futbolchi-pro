/**
 * Texts of the admin Telegram bot in uz / en / ru. The language follows the
 * admin's Telegram app language (uz by default).
 */
import type { BotLang, RejectReason } from '../domain';

export interface BotText {
  newReceipt: string;
  player: string;
  amount: string;
  sent: string;
  approve: string;
  reject: string;
  details: string;
  back: string;
  openPanel: string;
  chooseReason: string;
  reasons: Record<RejectReason, string>;
  approved: string;
  rejected: (reason: string) => string;
  alreadyDecided: string;
  notAllowed: string;
  notFound: string;
  failed: string;
  welcome: string;
  linked: string;
  groupLinked: string;
  linkFirst: string;
  unlinked: string;
  badToken: string;
  adminOff: string;
  noneWaiting: string;
  waitingCount: (n: number) => string;
  detailsTitle: string;
  history: (total: number, approved: number, rejected: number) => string;
  firstPayment: string;
  imageNew: string;
  imageDuplicate: (list: string) => string;
  minutesAgo: (m: number) => string;
  help: string;
}

export const BOT_TEXT: Record<BotLang, BotText> = {
  uz: {
    newReceipt: '🧾 Yangi chek',
    player: "O'yinchi",
    amount: 'Summa',
    sent: 'Yuborildi',
    approve: '✅ Qabul qilish',
    reject: '❌ Rad etish',
    details: '🔍 Batafsil',
    back: '↩️ Orqaga',
    openPanel: '🖥 Admin panel',
    chooseReason: 'Rad etish sababini tanlang — o\'yinchi uni o\'z tilida ko\'radi.',
    reasons: {
      amount: "Summa noto'g'ri",
      unreadable: "Chek o'qilmaydi",
      not_received: 'Pul kelib tushmadi',
      duplicate: 'Bu chek avval ishlatilgan',
    },
    approved: '✅ QABUL QILINDI',
    rejected: (r) => `❌ RAD ETILDI: ${r}`,
    alreadyDecided: "Bu chek allaqachon ko'rib chiqilgan.",
    notAllowed: "Sizda ruxsat yo'q.",
    notFound: 'Chek topilmadi.',
    failed: "Xatolik. Qayta urinib ko'ring.",
    welcome:
      "Salom! Bu Futbolchi Pro admin boti.\nUlash uchun admin tokenini shu yerga yuboring (xabar darhol o'chiriladi).",
    linked: "✅ Ulandi. Endi har bir yangi chek shu yerga keladi.\n/pending — kutayotgan cheklar\n/stop — uzish\n\nGuruhda tekshirish uchun: botni guruhga qo'shing va u yerda /link yozing.",
    groupLinked: "✅ Guruh ulandi. Yangi cheklar shu yerga keladi va guruhdagi har kim tugmalarni bosa oladi — guruhga faqat ishonchli odamlarni qo'shing.\n/pending — kutayotgan cheklar\n/stop — guruhni uzish",
    linkFirst: 'Avval botga shaxsiy chatda admin tokenini yuborib ulaning, keyin shu guruhda /link yozing.',
    unlinked: 'Uzildi. Bu chatga endi chek kelmaydi.',
    badToken: "Token noto'g'ri.",
    adminOff: "Serverda ADMIN_TOKEN sozlanmagan — admin o'chiq.",
    noneWaiting: "Kutayotgan chek yo'q. 👌",
    waitingCount: (n) => `Kutayotgan cheklar: ${n}`,
    detailsTitle: '🔍 Batafsil',
    history: (t, a, r) => `Bu o'yinchining to'lovlari: ${t} ta (qabul: ${a}, rad: ${r})`,
    firstPayment: "Bu o'yinchining birinchi to'lovi.",
    imageNew: '✅ Bu rasm avval yuborilmagan.',
    imageDuplicate: (l) => `⚠️ Xuddi shu rasm avval ham yuborilgan:\n${l}`,
    minutesAgo: (m) => `${m} daqiqa oldin`,
    help: "/pending — kutayotgan cheklar\n/stop — bu chatni uzish\n/link — guruhni ulash (guruhning o'zida yozing)",
  },
  en: {
    newReceipt: '🧾 New receipt',
    player: 'Player',
    amount: 'Amount',
    sent: 'Sent',
    approve: '✅ Approve',
    reject: '❌ Reject',
    details: '🔍 Details',
    back: '↩️ Back',
    openPanel: '🖥 Admin panel',
    chooseReason: 'Pick the reason — the player sees it in their own language.',
    reasons: {
      amount: 'Wrong amount',
      unreadable: 'Receipt is unreadable',
      not_received: 'Money not received',
      duplicate: 'Receipt already used',
    },
    approved: '✅ APPROVED',
    rejected: (r) => `❌ REJECTED: ${r}`,
    alreadyDecided: 'This receipt has already been reviewed.',
    notAllowed: 'You are not allowed to do this.',
    notFound: 'Receipt not found.',
    failed: 'Something went wrong. Please try again.',
    welcome: 'Hi! This is the Futbolchi Pro admin bot.\nTo link this chat, send the admin token here (the message is deleted right away).',
    linked: '✅ Linked. Every new receipt will arrive here.\n/pending — receipts waiting\n/stop — unlink\n\nTo review in a group: add the bot to the group and type /link there.',
    groupLinked: '✅ Group linked. New receipts arrive here and every member can press the buttons — add only people you trust.\n/pending — receipts waiting\n/stop — unlink the group',
    linkFirst: 'First link your private chat with the bot by sending it the admin token, then type /link in this group.',
    unlinked: 'Unlinked. Receipts will no longer come to this chat.',
    badToken: 'Wrong token.',
    adminOff: 'ADMIN_TOKEN is not set on the server — admin is off.',
    noneWaiting: 'No receipts waiting. 👌',
    waitingCount: (n) => `Receipts waiting: ${n}`,
    detailsTitle: '🔍 Details',
    history: (t, a, r) => `This player's payments: ${t} (approved: ${a}, rejected: ${r})`,
    firstPayment: "This is the player's first payment.",
    imageNew: '✅ This image has not been sent before.',
    imageDuplicate: (l) => `⚠️ The same image was sent before:\n${l}`,
    minutesAgo: (m) => `${m} min ago`,
    help: '/pending — receipts waiting\n/stop — unlink this chat\n/link — link a group (type it in the group)',
  },
  ru: {
    newReceipt: '🧾 Новый чек',
    player: 'Игрок',
    amount: 'Сумма',
    sent: 'Отправлен',
    approve: '✅ Принять',
    reject: '❌ Отклонить',
    details: '🔍 Подробнее',
    back: '↩️ Назад',
    openPanel: '🖥 Админ-панель',
    chooseReason: 'Выберите причину — игрок увидит её на своём языке.',
    reasons: {
      amount: 'Неверная сумма',
      unreadable: 'Чек не читается',
      not_received: 'Деньги не поступили',
      duplicate: 'Чек уже использован',
    },
    approved: '✅ ПРИНЯТ',
    rejected: (r) => `❌ ОТКЛОНЁН: ${r}`,
    alreadyDecided: 'Этот чек уже проверен.',
    notAllowed: 'У вас нет доступа.',
    notFound: 'Чек не найден.',
    failed: 'Ошибка. Попробуйте ещё раз.',
    welcome: 'Привет! Это админ-бот Futbolchi Pro.\nЧтобы подключить этот чат, отправьте сюда админ-токен (сообщение сразу удалится).',
    linked: '✅ Подключено. Все новые чеки будут приходить сюда.\n/pending — чеки в ожидании\n/stop — отключить\n\nЧтобы проверять в группе: добавьте бота в группу и напишите там /link.',
    groupLinked: '✅ Группа подключена. Новые чеки будут приходить сюда, и любой участник может нажимать кнопки — добавляйте только тех, кому доверяете.\n/pending — чеки в ожидании\n/stop — отключить группу',
    linkFirst: 'Сначала подключите личный чат: отправьте боту админ-токен, затем напишите /link в этой группе.',
    unlinked: 'Отключено. Чеки больше не будут приходить в этот чат.',
    badToken: 'Неверный токен.',
    adminOff: 'На сервере не задан ADMIN_TOKEN — админка выключена.',
    noneWaiting: 'Чеков в ожидании нет. 👌',
    waitingCount: (n) => `Чеков в ожидании: ${n}`,
    detailsTitle: '🔍 Подробнее',
    history: (t, a, r) => `Платежи этого игрока: ${t} (принято: ${a}, отклонено: ${r})`,
    firstPayment: 'Это первый платёж игрока.',
    imageNew: '✅ Это изображение раньше не присылали.',
    imageDuplicate: (l) => `⚠️ Это же изображение уже присылали:\n${l}`,
    minutesAgo: (m) => `${m} мин назад`,
    help: '/pending — чеки в ожидании\n/stop — отключить этот чат\n/link — подключить группу (напишите в самой группе)',
  },
};

export const botLang = (code: string | undefined): BotLang =>
  code?.startsWith('ru') ? 'ru' : code?.startsWith('en') ? 'en' : 'uz';
