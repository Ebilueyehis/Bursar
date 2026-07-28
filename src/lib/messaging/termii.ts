import type {
  MessagingProvider,
  OutgoingMessage,
  SendResult,
} from "@/lib/messaging/provider";

/**
 * Termii adapter (https://termii.com) — Nigeria-focused SMS + WhatsApp with
 * local sender IDs and better in-country delivery than global providers.
 *
 * This runs SERVER-SIDE only. The API key must never reach the browser, so
 * screens call an internal API route (e.g. /api/reminders) that uses this
 * adapter — they never import it directly. Wire it up once TERMII_API_KEY and a
 * registered sender ID exist.
 */

const TERMII_BASE = "https://api.ng.termii.com/api";

interface TermiiConfig {
  apiKey: string;
  senderId: string; // must be pre-registered with Termii
}

export function createTermiiProvider(config: TermiiConfig): MessagingProvider {
  return {
    async send(message: OutgoingMessage): Promise<SendResult> {
      try {
        const res = await fetch(`${TERMII_BASE}/sms/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: config.apiKey,
            to: normalizeNgPhone(message.to),
            from: config.senderId,
            sms: message.body,
            type: "plain",
            channel: message.channel === "whatsapp" ? "whatsapp" : "generic",
          }),
        });
        const data = (await res.json()) as { message_id?: string; message?: string };
        if (!res.ok) {
          return { ok: false, channel: message.channel, to: message.to, error: data.message ?? `Termii error ${res.status}` };
        }
        return { ok: true, channel: message.channel, to: message.to, providerRef: data.message_id };
      } catch (e) {
        return {
          ok: false,
          channel: message.channel,
          to: message.to,
          error: e instanceof Error ? e.message : "Network error",
        };
      }
    },
  };
}

/** Normalize a Nigerian number to international format (2348030000000). */
export function normalizeNgPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  return digits;
}
