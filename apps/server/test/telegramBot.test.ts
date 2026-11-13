import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { ManualPaymentProvider } from '../src/payments/ManualPaymentProvider';
import { JsonStore } from '../src/store/jsonStore';
import { BOT_TEXT } from '../src/notify/botText';
import type { TelegramApi, TgUpdate } from '../src/notify/telegram';

const TOKEN = 'admin-test';
const CHAT = '5001';
/** 1×1 PNGs: two different images. */
const PNG_A = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG_B = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const uz = BOT_TEXT.uz;

type Call = { method: string; params: Record<string, unknown> };

function fakeTelegram() {
  const calls: Call[] = [];
  let nextId = 100;
  const api: TelegramApi = {
    async call<T>(method: string, params: Record<string, unknown> | FormData): Promise<T> {
      const p =
        params instanceof FormData
          ? Object.fromEntries([...params.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '<file>']))
          : params;
      calls.push({ method, params: p });
      if (method === 'sendPhoto' || method === 'sendMessage') return { message_id: nextId++, chat: { id: Number(p.chat_id), type: 'private' } } as T;
      return true as T;
    },
  };
  return { api, calls, of: (m: string) => calls.filter((c) => c.method === m), clear: () => calls.splice(0) };
}

const tick = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

function setup(chatId: string | null = CHAT) {
  const tg = fakeTelegram();
  const store = new JsonStore(null);
  const { app, bot } = buildApp({
    store,
    provider: new ManualPaymentProvider('secret'),
    adminToken: TOKEN,
    telegram: { api: tg.api, chatId, adminUrl: 'http://localhost:5173/#/admin' },
  });
  const post = (url: string, payload: object, headers: Record<string, string> = {}) => app.inject({ method: 'POST', url, payload, headers });
  const upload = async (userId: string, name: string, image = PNG_A) => {
    await post('/api/users', { userId, name });
    const { paymentId } = (await post('/api/payments', { userId, product: 'persona_slot' })).json();
    expect((await post(`/api/payments/${paymentId}/proof`, { userId, dataUrl: image })).statusCode).toBe(200);
    await tick();
    return paymentId as string;
  };
  let updateId = 1;
  const press = async (data: string, chat = CHAT) => {
    const u: TgUpdate = {
      update_id: updateId++,
      callback_query: { id: `cb${updateId}`, from: { id: Number(chat), language_code: 'uz' }, data, message: { message_id: 100, chat: { id: Number(chat), type: 'private' } } },
    };
    await bot!.handleUpdate(u);
    await tick();
  };
  const say = async (text: string, chat = CHAT) => {
    await bot!.handleUpdate({ update_id: updateId++, message: { message_id: 900 + updateId, chat: { id: Number(chat), type: 'private' }, from: { id: Number(chat), language_code: 'uz' }, text } });
    await tick();
  };
  /** A message in a group, sent by user `from`. */
  const sayInGroup = async (text: string, group: string, from: string) => {
    await bot!.handleUpdate({ update_id: updateId++, message: { message_id: 900 + updateId, chat: { id: Number(group), type: 'supergroup' }, from: { id: Number(from), language_code: 'uz' }, text } });
    await tick();
  };
  /** A button press in a group by user `from`. */
  const pressInGroup = async (data: string, group: string, from: string, username: string) => {
    await bot!.handleUpdate({
      update_id: updateId++,
      callback_query: { id: `cb${updateId}`, from: { id: Number(from), username, language_code: 'uz' }, data, message: { message_id: 100, chat: { id: Number(group), type: 'supergroup' } } },
    });
    await tick();
  };
  const state = async (paymentId: string) => (await app.inject({ method: 'GET', url: `/api/payments/${paymentId}` })).json();
  const entitlements = async (userId: string) => (await app.inject({ method: 'GET', url: `/api/entitlements?userId=${userId}` })).json().entitlements;
  return { app, bot: bot!, tg, store, upload, press, say, sayInGroup, pressInGroup, state, entitlements, post };
}

describe('admin Telegram bot', () => {
  it('sends every receipt as a photo with approve / reject / details buttons', async () => {
    const ctx = setup();
    const paymentId = await ctx.upload('u1', 'Aziz');
    const [photo] = ctx.tg.of('sendPhoto');
    expect(photo.params.chat_id).toBe(CHAT);
    expect(photo.params.photo).toBe('<file>');
    expect(photo.params.caption).toContain('Aziz');
    expect(photo.params.caption).toContain('5 000 UZS');
    const kb = JSON.parse(String(photo.params.reply_markup)).inline_keyboard.flat().map((b: { callback_data: string }) => b.callback_data);
    expect(kb).toEqual([`a:${paymentId}`, `r:${paymentId}`, `i:${paymentId}`]);
    expect(ctx.store.read((db) => db.proofs[paymentId].telegram)).toEqual([{ chatId: CHAT, messageId: 100 }]);
  });

  it('approve grants access once and updates the message; a second press says it is done', async () => {
    const ctx = setup();
    const paymentId = await ctx.upload('u1', 'Aziz');
    await ctx.press(`a:${paymentId}`);
    expect(await ctx.state(paymentId)).toMatchObject({ status: 'paid', proof: 'approved' });
    expect(await ctx.entitlements('u1')).toHaveLength(1);
    const edit = ctx.tg.of('editMessageCaption').at(-1)!;
    expect(edit.params.caption).toContain(uz.approved);
    expect(edit.params.reply_markup).toEqual({ inline_keyboard: [] });

    await ctx.press(`a:${paymentId}`);
    expect(ctx.tg.of('answerCallbackQuery').at(-1)!.params.text).toBe(uz.alreadyDecided);
    expect(await ctx.entitlements('u1')).toHaveLength(1);
  });

  it('reject asks for a reason; the player gets the reason code', async () => {
    const ctx = setup();
    const paymentId = await ctx.upload('u1', 'Aziz');
    await ctx.press(`r:${paymentId}`);
    const kb = ctx.tg.of('editMessageReplyMarkup').at(-1)!.params.reply_markup as { inline_keyboard: { callback_data: string }[][] };
    expect(kb.inline_keyboard.flat().map((b) => b.callback_data)).toEqual([
      `R:0:${paymentId}`,
      `R:1:${paymentId}`,
      `R:2:${paymentId}`,
      `R:3:${paymentId}`,
      `b:${paymentId}`,
    ]);
    await ctx.press(`R:2:${paymentId}`);
    expect(await ctx.state(paymentId)).toMatchObject({ status: 'failed', proof: 'rejected', reason: 'not_received' });
    expect(await ctx.entitlements('u1')).toHaveLength(0);
    expect(ctx.tg.of('editMessageCaption').at(-1)!.params.caption).toContain(uz.rejected(uz.reasons.not_received));
  });

  it('ignores buttons from chats that are not admins', async () => {
    const ctx = setup();
    const paymentId = await ctx.upload('u1', 'Aziz');
    await ctx.press(`a:${paymentId}`, '666');
    expect(ctx.tg.of('answerCallbackQuery').at(-1)!.params.text).toBe(uz.notAllowed);
    expect(await ctx.state(paymentId)).toMatchObject({ status: 'pending', proof: 'submitted' });
  });

  it('details show the history and flag a screenshot that was already sent', async () => {
    const ctx = setup();
    const first = await ctx.upload('u1', 'Aziz', PNG_A);
    await ctx.press(`R:1:${first}`);
    const other = await ctx.upload('u2', 'Sardor', PNG_B);
    expect(ctx.bot.details(other, 'uz')).toContain(uz.imageNew);
    expect(ctx.bot.details(other, 'uz')).toContain(uz.firstPayment);

    const copy = await ctx.upload('u3', 'Botir', PNG_A);
    const text = ctx.bot.details(copy, 'uz');
    expect(text).toContain('⚠️');
    expect(text).toContain('Aziz');
    expect(text).toContain(first);

    await ctx.press(`i:${copy}`);
    expect(ctx.tg.of('sendMessage').at(-1)!.params.text).toBe(text);
  });

  it('a decision in the admin panel also updates the Telegram message', async () => {
    const ctx = setup();
    const paymentId = await ctx.upload('u1', 'Aziz');
    await ctx.post(`/api/admin/payments/${paymentId}/decision`, { decision: 'approve' }, { 'x-admin-token': TOKEN });
    await tick();
    expect(ctx.tg.of('editMessageCaption').at(-1)!.params).toMatchObject({ chat_id: CHAT, message_id: 100, reply_markup: { inline_keyboard: [] } });
  });

  it('links a chat with the admin token (message deleted), unlinks with /stop, limits guesses', async () => {
    const ctx = setup(null);
    await ctx.say('/start', '42');
    expect(ctx.tg.of('sendMessage').at(-1)!.params.text).toBe(uz.welcome);

    await ctx.say('wrong', '42');
    expect(ctx.tg.of('deleteMessage')).toHaveLength(1);
    expect(ctx.tg.of('sendMessage').at(-1)!.params.text).toBe(uz.badToken);

    await ctx.say(TOKEN, '42');
    expect(ctx.tg.of('deleteMessage')).toHaveLength(2);
    expect(ctx.tg.of('sendMessage').at(-1)!.params.text).toBe(uz.linked);

    await ctx.upload('u1', 'Aziz');
    expect(ctx.tg.of('sendPhoto').map((c) => c.params.chat_id)).toEqual(['42']);

    await ctx.say('/stop', '42');
    expect(ctx.tg.of('sendMessage').at(-1)!.params.text).toBe(uz.unlinked);
    ctx.tg.clear();
    await ctx.upload('u2', 'Sardor');
    expect(ctx.tg.of('sendPhoto')).toHaveLength(0);

    // Brute force: after 5 wrong guesses the bot stops answering for an hour.
    for (let i = 0; i < 6; i++) await ctx.say(`guess${i}`, '77');
    expect(ctx.tg.of('sendMessage').filter((c) => c.params.chat_id === '77')).toHaveLength(5);
    await ctx.say(TOKEN, '77');
    expect(ctx.store.read((db) => db.telegram.admins['77'])).toBeUndefined();
  });

  it('/pending re-sends the receipts still waiting', async () => {
    const ctx = setup();
    const a = await ctx.upload('u1', 'Aziz');
    await ctx.upload('u2', 'Sardor', PNG_B);
    await ctx.press(`a:${a}`);
    ctx.tg.clear();
    await ctx.say('/pending');
    expect(ctx.tg.of('sendMessage')[0].params.text).toBe(uz.waitingCount(1));
    expect(ctx.tg.of('sendPhoto')).toHaveLength(1);
  });
});

describe('admin Telegram bot in a group', () => {
  const GROUP = '-1001234';

  it('only a linked admin can link a group; then receipts go there and any member can decide', async () => {
    const ctx = setup(null);
    // A stranger cannot link the group, and the token is never needed in the group.
    await ctx.sayInGroup('/link@Futprouz_bot', GROUP, '555');
    expect(ctx.tg.of('sendMessage').at(-1)!.params).toMatchObject({ chat_id: GROUP, text: uz.linkFirst });
    expect(ctx.store.read((db) => db.telegram.admins[GROUP])).toBeUndefined();

    await ctx.say(TOKEN, '42'); // owner links their private chat
    await ctx.sayInGroup('/link@Futprouz_bot', GROUP, '42');
    expect(ctx.tg.of('sendMessage').at(-1)!.params).toMatchObject({ chat_id: GROUP, text: uz.groupLinked });

    const paymentId = await ctx.upload('u1', 'Aziz');
    expect(ctx.tg.of('sendPhoto').map((c) => c.params.chat_id).sort()).toEqual([GROUP, '42'].sort());

    // A teammate in the group approves; every message shows who did it.
    await ctx.pressInGroup(`a:${paymentId}`, GROUP, '777', 'kassir');
    expect(await ctx.state(paymentId)).toMatchObject({ status: 'paid', proof: 'approved' });
    const edits = ctx.tg.of('editMessageCaption');
    expect(edits.map((e) => e.params.chat_id).sort()).toEqual([GROUP, '42'].sort());
    for (const e of edits) expect(e.params.caption).toContain(`${uz.approved} — @kassir`);
  });

  it('/pending works in a linked group; /stop by a stranger is ignored, by the admin unlinks', async () => {
    const ctx = setup(null);
    await ctx.say(TOKEN, '42');
    await ctx.sayInGroup('/link', GROUP, '42');
    await ctx.upload('u1', 'Aziz');
    ctx.tg.clear();
    await ctx.sayInGroup('/pending@Futprouz_bot', GROUP, '777');
    expect(ctx.tg.of('sendPhoto').map((c) => c.params.chat_id)).toEqual([GROUP]);

    await ctx.sayInGroup('/stop', GROUP, '777');
    expect(ctx.store.read((db) => db.telegram.admins[GROUP])).toBeDefined();
    await ctx.sayInGroup('/stop', GROUP, '42');
    expect(ctx.store.read((db) => db.telegram.admins[GROUP])).toBeUndefined();
  });

  it('keeps a group linked when it turns into a supergroup', async () => {
    const ctx = setup(null);
    await ctx.say(TOKEN, '42');
    await ctx.sayInGroup('/link', '-55', '42');
    await ctx.bot.handleUpdate({ update_id: 999, message: { message_id: 1, chat: { id: -55, type: 'group' }, migrate_to_chat_id: -1009 } });
    expect(ctx.store.read((db) => Object.keys(db.telegram.admins).sort())).toEqual(['-1009', '42']);
  });
});

describe('bot texts', () => {
  it('uz, en and ru have the same keys and reasons', () => {
    const keys = (o: object) => Object.keys(o).sort();
    expect(keys(BOT_TEXT.en)).toEqual(keys(BOT_TEXT.uz));
    expect(keys(BOT_TEXT.ru)).toEqual(keys(BOT_TEXT.uz));
    expect(keys(BOT_TEXT.en.reasons)).toEqual(keys(BOT_TEXT.uz.reasons));
    expect(keys(BOT_TEXT.ru.reasons)).toEqual(keys(BOT_TEXT.uz.reasons));
    expect(BOT_TEXT.en.welcome).not.toBe(BOT_TEXT.uz.welcome);
    expect(BOT_TEXT.ru.welcome).not.toBe(BOT_TEXT.uz.welcome);
  });
});
