import type {
  MessagingProvider,
  OutgoingMessage,
  SendResult,
} from "@/lib/messaging/provider";

/**
 * Mock messaging provider. It "sends" by logging and returning success after a
 * short delay, so reminder flows are fully demonstrable before a real SMS
 * account (Termii) is connected. No message actually leaves the device.
 */
export const mockMessaging: MessagingProvider = {
  async send(message: OutgoingMessage): Promise<SendResult> {
    await new Promise((r) => setTimeout(r, 600));
    // eslint-disable-next-line no-console
    console.info("[Bursar mock messaging]", message.channel, "→", message.to, ":", message.body);
    return {
      ok: true,
      channel: message.channel,
      to: message.to,
      providerRef: `mock-${Date.now()}`,
    };
  },
};

/** The active provider. Swap for the Termii adapter when credentials exist. */
export { mockMessaging as messaging };
