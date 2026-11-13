/**
 * Instant receipt alerts for the admin.
 *
 * When a player uploads a receipt ("chek"), the server forwards the image to
 * the admin's Telegram through a bot, so the admin sees it within seconds,
 * even with the admin panel closed. Optional: enabled only when both
 * TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set.
 *
 * The caption uses icons and numbers only, so it reads the same in any language.
 */
import type { ProofMime } from '../store/proofStorage';

export interface ProofNotice {
  paymentId: string;
  userName: string | null;
  amountMinor: number;
  mime: ProofMime;
  data: Buffer;
}

export interface ProofNotifier {
  proofSubmitted(notice: ProofNotice): Promise<void>;
}

const EXT: Record<ProofMime, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** "500000" tiyin → "5 000 UZS". */
const money = (minor: number) => `${Math.round(minor / 100).toLocaleString('en-US').replace(/,/g, ' ')} UZS`;

export function proofCaption(n: Omit<ProofNotice, 'data' | 'mime'>, adminUrl: string | null): string {
  return [`🧾 ${n.paymentId}`, `👤 ${n.userName ?? '—'}`, `💰 ${money(n.amountMinor)}`, ...(adminUrl ? [`🔗 ${adminUrl}`] : [])].join('\n');
}

export class TelegramNotifier implements ProofNotifier {
  constructor(
    private readonly botToken: string,
    private readonly chatId: string,
    /** Link to the admin panel, added to the message. */
    private readonly adminUrl: string | null = null,
  ) {}

  async proofSubmitted(n: ProofNotice): Promise<void> {
    const form = new FormData();
    form.set('chat_id', this.chatId);
    form.set('caption', proofCaption(n, this.adminUrl));
    form.set('photo', new Blob([new Uint8Array(n.data)], { type: n.mime }), `chek.${EXT[n.mime]}`);
    const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`telegram sendPhoto → ${res.status}`);
  }
}
