/**
 * Admin Telegram bot: receipts arrive as photos with buttons, so the admin
 * can approve or reject from the phone in one tap.
 *
 *  - Each uploaded receipt is sent to every admin chat with
 *    [✅ Approve] [❌ Reject] [🔍 Details].
 *  - Reject asks for a reason; the player sees it in their own language.
 *  - Details: the player's payment history and whether the same image was
 *    sent before (a reused screenshot is a common trick).
 *  - When a receipt is decided anywhere (bot or admin panel), every message
 *    about it is updated and its buttons disappear.
 *
 * Admin chats: TELEGRAM_CHAT_ID (if set), private chats linked by sending the
 * admin token to the bot (the message is deleted at once), and groups: an
 * already linked admin adds the bot to a group and types /link there. In a
 * linked group every member can press the buttons, and each decision shows
 * who made it. /stop unlinks a chat.
 *
 * No public URL is needed: the server asks Telegram for updates (long polling).
 */
import { REJECT_REASONS, type BotLang, type RejectReason } from '../domain';
import type { JsonStore } from '../store/jsonStore';
import type { ProofMime } from '../store/proofStorage';
import { BOT_TEXT, botLang } from './botText';

// ---------- Telegram HTTP API ----------
export class TelegramError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

export interface TelegramApi {
  call<T = unknown>(method: string, params: Record<string, unknown> | FormData): Promise<T>;
}

export class TelegramHttp implements TelegramApi {
  constructor(private readonly token: string) {}
  async call<T>(method: string, params: Record<string, unknown> | FormData): Promise<T> {
    const isForm = params instanceof FormData;
    const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: isForm ? undefined : { 'content-type': 'application/json' },
      body: isForm ? params : JSON.stringify(params),
      signal: AbortSignal.timeout(method === 'getUpdates' ? 40_000 : 15_000),
    });
    const json = (await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }))) as {
      ok: boolean;
      result?: T;
      error_code?: number;
      description?: string;
    };
    if (!json.ok) throw new TelegramError(json.error_code ?? res.status, json.description ?? `HTTP ${res.status}`);
    return json.result as T;
  }
}

// ---------- Bot ----------
export interface ProofNotice {
  paymentId: string;
  mime: ProofMime;
  data: Buffer;
}

type Decision = 'approve' | 'reject';
/** 'ok' = this call decided it; 'already' = it was decided before. */
export type DecideResult = 'ok' | 'already' | 'not_found';

export interface AdminBotOptions {
  api: TelegramApi;
  store: JsonStore;
  adminToken: string | null;
  /** TELEGRAM_CHAT_ID: always an admin chat. */
  chatId: string | null;
  /** Link to the admin panel, shown in details. */
  adminUrl: string | null;
  decide: (paymentId: string, decision: Decision, reason?: RejectReason, by?: string) => Promise<DecideResult>;
  readProof: (paymentId: string) => { mime: ProofMime; data: Buffer } | null;
  log?: { info: (msg: string) => void; warn: (msg: string) => void };
}

interface TgUser {
  id: number;
  language_code?: string;
  first_name?: string;
  username?: string;
}
interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  /** A group became a supergroup: its chat id changed. */
  migrate_to_chat_id?: number;
}
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage };
}

type Button = { text: string; callback_data?: string; url?: string };

const money = (minor: number) => `${Math.round(minor / 100).toLocaleString('en-US').replace(/,/g, ' ')} UZS`;
const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const time = (iso: string) => TIME.format(new Date(iso)).replace(',', '');
/** Failed token guesses allowed per chat per hour. */
const MAX_TRIES = 5;

export class AdminBot {
  private running = false;
  private tries = new Map<string, { n: number; since: number }>();

  constructor(private readonly o: AdminBotOptions) {}

  // ----- admin chats -----
  private admins(): { chatId: string; lang: BotLang }[] {
    const linked = this.o.store.read((db) => Object.values(db.telegram.admins));
    const list = linked.map((a) => ({ chatId: a.chatId, lang: a.lang }));
    if (this.o.chatId && !list.some((a) => a.chatId === this.o.chatId)) list.unshift({ chatId: this.o.chatId, lang: 'uz' });
    return list;
  }
  private isAdmin(chatId: string) {
    return this.admins().some((a) => a.chatId === chatId);
  }

  // ----- texts and buttons -----
  caption(paymentId: string, lang: BotLang): string {
    const t = BOT_TEXT[lang];
    return this.o.store.read((db) => {
      const p = db.payments[paymentId];
      const proof = db.proofs[paymentId];
      const lines = [
        t.newReceipt,
        `👤 ${t.player}: ${(p && db.users[p.userId]?.name) ?? '—'}`,
        `💰 ${t.amount}: ${p ? money(p.amountMinor) : '—'}`,
        ...(proof ? [`🕒 ${t.sent}: ${time(proof.uploadedAt)}`] : []),
        `🆔 ${paymentId}`,
      ];
      const by = proof?.reviewedBy ? ` — ${proof.reviewedBy}` : '';
      if (proof?.status === 'approved') lines.push('', t.approved + by);
      if (proof?.status === 'rejected') lines.push('', t.rejected(proof.reason ? t.reasons[proof.reason] : (proof.note ?? '—')) + by);
      return lines.join('\n');
    });
  }

  keyboard(paymentId: string, lang: BotLang, mode: 'main' | 'reasons'): { inline_keyboard: Button[][] } {
    const t = BOT_TEXT[lang];
    if (mode === 'reasons') {
      return {
        inline_keyboard: [
          ...REJECT_REASONS.map((r, i) => [{ text: `❌ ${t.reasons[r]}`, callback_data: `R:${i}:${paymentId}` }]),
          [{ text: t.back, callback_data: `b:${paymentId}` }],
        ],
      };
    }
    const rows: Button[][] = [
      [
        { text: t.approve, callback_data: `a:${paymentId}` },
        { text: t.reject, callback_data: `r:${paymentId}` },
      ],
      [{ text: t.details, callback_data: `i:${paymentId}` }],
    ];
    // Telegram only accepts public https links on buttons.
    if (this.o.adminUrl?.startsWith('https://')) rows.push([{ text: t.openPanel, url: this.o.adminUrl }]);
    return { inline_keyboard: rows };
  }

  details(paymentId: string, lang: BotLang): string {
    const t = BOT_TEXT[lang];
    return this.o.store.read((db) => {
      const p = db.payments[paymentId];
      const proof = db.proofs[paymentId];
      if (!p || !proof) return t.notFound;
      const name = db.users[p.userId]?.name ?? '—';
      const minutes = Math.max(0, Math.round((Date.now() - Date.parse(proof.uploadedAt)) / 60_000));
      const mine = Object.values(db.payments).filter((x) => x.userId === p.userId && x.id !== p.id && db.proofs[x.id]);
      const approved = mine.filter((x) => db.proofs[x.id].status === 'approved').length;
      const rejected = mine.filter((x) => db.proofs[x.id].status === 'rejected').length;
      const same = proof.sha256
        ? Object.values(db.proofs).filter((x) => x.paymentId !== paymentId && x.sha256 === proof.sha256)
        : [];
      const sameLines = same
        .slice(0, 5)
        .map((x) => {
          const owner = db.payments[x.paymentId] ? (db.users[db.payments[x.paymentId].userId]?.name ?? '—') : '—';
          return `• ${owner} — ${time(x.uploadedAt)} — ${x.status} — ${x.paymentId}`;
        })
        .join('\n');
      return [
        `${t.detailsTitle} — 🆔 ${paymentId}`,
        `👤 ${t.player}: ${name} (${p.userId})`,
        `💰 ${t.amount}: ${money(p.amountMinor)}`,
        `🕒 ${t.sent}: ${time(proof.uploadedAt)} (${t.minutesAgo(minutes)})`,
        '',
        `📜 ${mine.length ? t.history(mine.length, approved, rejected) : t.firstPayment}`,
        same.length ? t.imageDuplicate(sameLines) : t.imageNew,
        ...(this.o.adminUrl ? ['', `🖥 ${this.o.adminUrl}`] : []),
      ].join('\n');
    });
  }

  // ----- outgoing -----
  private async sendReceipt(chatId: string, lang: BotLang, paymentId: string, image?: { mime: ProofMime; data: Buffer }) {
    const file = image ?? this.o.readProof(paymentId);
    if (!file) return;
    const form = new FormData();
    form.set('chat_id', chatId);
    form.set('caption', this.caption(paymentId, lang));
    form.set('reply_markup', JSON.stringify(this.keyboard(paymentId, lang, 'main')));
    const ext = file.mime === 'image/png' ? 'png' : file.mime === 'image/webp' ? 'webp' : 'jpg';
    form.set('photo', new Blob([new Uint8Array(file.data)], { type: file.mime }), `chek.${ext}`);
    const msg = await this.o.api.call<TgMessage>('sendPhoto', form);
    this.o.store.transaction((db) => {
      const proof = db.proofs[paymentId];
      if (proof) proof.telegram = [...(proof.telegram ?? []), { chatId, messageId: msg.message_id }];
    });
  }

  /** New receipt: send it to every admin chat. */
  async proofSubmitted(n: ProofNotice): Promise<void> {
    const results = await Promise.allSettled(this.admins().map((a) => this.sendReceipt(a.chatId, a.lang, n.paymentId, n)));
    for (const r of results) if (r.status === 'rejected') this.o.log?.warn(`[telegram] receipt not sent: ${String(r.reason)}`);
  }

  /** A receipt was decided: update every message about it and drop the buttons. */
  async decided(paymentId: string): Promise<void> {
    const messages = this.o.store.read((db) => db.proofs[paymentId]?.telegram ?? []);
    const langOf = new Map(this.admins().map((a) => [a.chatId, a.lang]));
    await Promise.allSettled(
      messages.map((m) =>
        this.o.api.call('editMessageCaption', {
          chat_id: m.chatId,
          message_id: m.messageId,
          caption: this.caption(paymentId, langOf.get(m.chatId) ?? 'uz'),
          reply_markup: { inline_keyboard: [] },
        }),
      ),
    );
  }

  private send(chatId: string, text: string, extra: Record<string, unknown> = {}) {
    return this.o.api.call('sendMessage', { chat_id: chatId, text, ...extra });
  }

  // ----- incoming -----
  async handleUpdate(u: TgUpdate): Promise<void> {
    if (u.callback_query) return this.onButton(u.callback_query);
    const m = u.message;
    if (!m) return;
    if (m.migrate_to_chat_id) return this.migrate(String(m.chat.id), String(m.migrate_to_chat_id));
    const isGroup = m.chat.type === 'group' || m.chat.type === 'supergroup';
    if (!m.text || (m.chat.type !== 'private' && !isGroup)) return;
    const chatId = String(m.chat.id);
    const lang = botLang(m.from?.language_code);
    const t = BOT_TEXT[lang];
    const text = m.text.trim();
    const [rawCmd, ...rest] = text.split(/\s+/);
    // In groups commands come as "/link@BotName".
    const cmd = rawCmd.replace(/@\w+$/, '');
    const admin = this.isAdmin(chatId);
    if (isGroup) return this.onGroup(m, chatId, cmd, lang);

    if (cmd === '/stop') {
      const had = this.o.store.transaction((db) => {
        const had = !!db.telegram.admins[chatId];
        delete db.telegram.admins[chatId];
        return had;
      });
      if (had) await this.send(chatId, t.unlinked);
      return;
    }
    if (cmd === '/pending' && admin) return this.sendPending(chatId, lang);

    // Linking: "/start <token>" or the token on its own.
    const guess = cmd === '/start' ? rest.join(' ') : text.startsWith('/') ? '' : text;
    if (guess && !admin) return this.tryLink(m, chatId, lang, guess);
    if (admin) return void (await this.send(chatId, t.help));
    await this.send(chatId, this.o.adminToken ? t.welcome : t.adminOff);
  }

  private async sendPending(chatId: string, lang: BotLang) {
    const t = BOT_TEXT[lang];
    const waiting = this.o.store.read((db) =>
      Object.values(db.proofs)
        .filter((p) => p.status === 'submitted' && db.payments[p.paymentId]?.status === 'pending')
        .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))
        .map((p) => p.paymentId),
    );
    if (!waiting.length) return void (await this.send(chatId, t.noneWaiting));
    await this.send(chatId, t.waitingCount(waiting.length));
    for (const id of waiting.slice(0, 10)) await this.sendReceipt(chatId, lang, id);
  }

  /**
   * Groups: only commands reach the bot (Telegram privacy mode). /link and
   * /stop are allowed only for someone who already linked their private chat,
   * so the admin token is never typed where the group can see it.
   */
  private async onGroup(m: TgMessage, chatId: string, cmd: string, lang: BotLang) {
    const t = BOT_TEXT[lang];
    const sender = m.from ? String(m.from.id) : '';
    const senderIsAdmin = this.o.store.read((db) => db.telegram.admins[sender]?.kind !== 'group' && !!db.telegram.admins[sender]) || sender === this.o.chatId;
    if (cmd === '/link') {
      if (!senderIsAdmin) return void (await this.send(chatId, t.linkFirst));
      this.o.store.transaction((db) => {
        db.telegram.admins[chatId] = { chatId, lang, linkedAt: new Date().toISOString(), kind: 'group' };
      });
      this.o.log?.info('[telegram] admin group linked');
      return void (await this.send(chatId, t.groupLinked));
    }
    if ((cmd === '/stop' || cmd === '/unlink') && senderIsAdmin) {
      this.o.store.transaction((db) => {
        delete db.telegram.admins[chatId];
      });
      return void (await this.send(chatId, t.unlinked));
    }
    if (cmd === '/pending' && this.isAdmin(chatId)) return this.sendPending(chatId, lang);
  }

  /** A group turned into a supergroup: keep it linked under its new id. */
  private migrate(from: string, to: string) {
    this.o.store.transaction((db) => {
      const a = db.telegram.admins[from];
      if (!a) return;
      delete db.telegram.admins[from];
      db.telegram.admins[to] = { ...a, chatId: to };
    });
  }

  private async tryLink(m: TgMessage, chatId: string, lang: BotLang, guess: string) {
    const t = BOT_TEXT[lang];
    if (!this.o.adminToken) return void (await this.send(chatId, t.adminOff));
    // The token must not stay in the chat history.
    await this.o.api.call('deleteMessage', { chat_id: chatId, message_id: m.message_id }).catch(() => null);
    const now = Date.now();
    const tr = this.tries.get(chatId);
    const fresh = tr && now - tr.since < 3_600_000 ? tr : { n: 0, since: now };
    if (fresh.n >= MAX_TRIES) return;
    if (guess !== this.o.adminToken) {
      this.tries.set(chatId, { ...fresh, n: fresh.n + 1 });
      return void (await this.send(chatId, t.badToken));
    }
    this.tries.delete(chatId);
    this.o.store.transaction((db) => {
      db.telegram.admins[chatId] = { chatId, lang, linkedAt: new Date().toISOString(), kind: 'private' };
    });
    this.o.log?.info(`[telegram] admin chat linked`);
    await this.send(chatId, t.linked);
  }

  private async onButton(q: NonNullable<TgUpdate['callback_query']>) {
    const chatId = q.message ? String(q.message.chat.id) : String(q.from.id);
    const lang = botLang(q.from.language_code);
    const t = BOT_TEXT[lang];
    const answer = (text = '') => this.o.api.call('answerCallbackQuery', { callback_query_id: q.id, text }).catch(() => null);
    if (!this.isAdmin(chatId)) return void (await answer(t.notAllowed));
    const [kind, a, b] = (q.data ?? '').split(':');
    const paymentId = kind === 'R' ? b : a;
    if (!paymentId) return void (await answer());
    const msg = q.message;
    const swap = (mode: 'main' | 'reasons') =>
      msg
        ? this.o.api.call('editMessageReplyMarkup', { chat_id: chatId, message_id: msg.message_id, reply_markup: this.keyboard(paymentId, lang, mode) })
        : null;

    try {
      if (kind === 'r' || kind === 'b') {
        const open = this.o.store.read((db) => db.proofs[paymentId]?.status === 'submitted');
        if (!open) {
          await this.decided(paymentId);
          return void (await answer(t.alreadyDecided));
        }
        await swap(kind === 'r' ? 'reasons' : 'main');
        return void (await answer(kind === 'r' ? t.chooseReason : ''));
      }
      if (kind === 'i') {
        await this.send(chatId, this.details(paymentId, lang), msg ? { reply_parameters: { message_id: msg.message_id } } : {});
        return void (await answer());
      }
      if (kind === 'a' || kind === 'R') {
        const reason = kind === 'R' ? REJECT_REASONS[Number(a)] : undefined;
        if (kind === 'R' && !reason) return void (await answer());
        const by = q.from.username ? `@${q.from.username}` : (q.from.first_name ?? String(q.from.id));
        const res = await this.o.decide(paymentId, kind === 'a' ? 'approve' : 'reject', reason, by);
        if (res === 'not_found') return void (await answer(t.notFound));
        // decide() updates the messages itself when it changed something.
        if (res === 'already') await this.decided(paymentId);
        return void (await answer(res === 'ok' ? (kind === 'a' ? t.approved : t.rejected(t.reasons[reason!])) : t.alreadyDecided));
      }
      await answer();
    } catch (err) {
      this.o.log?.warn(`[telegram] button failed: ${String(err)}`);
      await answer(t.failed);
    }
  }

  // ----- long polling -----
  async start(): Promise<void> {
    try {
      const me = await this.o.api.call<{ username: string }>('getMe', {});
      this.o.log?.info(`[telegram] bot @${me.username} is on; admin chats: ${this.admins().length}`);
      // A chat id the bot cannot reach yet: the owner has not pressed Start, or the id is wrong.
      if (this.o.chatId) {
        await this.o.api.call('getChat', { chat_id: this.o.chatId }).catch(() =>
          this.o.log?.warn(
            `[telegram] TELEGRAM_CHAT_ID is not reachable — open https://t.me/${me.username}, press Start and send the admin token to link your chat`,
          ),
        );
      }
    } catch (err) {
      const hint = err instanceof TelegramError && (err.code === 401 || err.code === 404) ? ' — check TELEGRAM_BOT_TOKEN (format 123456789:AA...)' : '';
      this.o.log?.warn(`[telegram] bot is off: ${String(err)}${hint}`);
      return;
    }
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private async loop() {
    while (this.running) {
      try {
        const offset = this.o.store.read((db) => db.telegram.offset);
        const updates = await this.o.api.call<TgUpdate[]>('getUpdates', {
          offset,
          timeout: 25,
          allowed_updates: ['message', 'callback_query'],
        });
        for (const u of updates) {
          this.o.store.transaction((db) => {
            db.telegram.offset = u.update_id + 1;
          });
          await this.handleUpdate(u).catch((err) => this.o.log?.warn(`[telegram] update failed: ${String(err)}`));
        }
      } catch (err) {
        if (!this.running) return;
        if (err instanceof TelegramError && err.code === 401) {
          this.o.log?.warn('[telegram] token rejected — bot stopped');
          return;
        }
        // Network hiccup or another copy polling (409): wait and retry.
        await new Promise((r) => setTimeout(r, 5000).unref());
      }
    }
  }
}
