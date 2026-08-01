import type { StudentAccount } from "@/lib/domain/types";
import { formatNaira } from "@/lib/money";

/**
 * Messaging is abstracted behind this interface so the app never depends on a
 * specific SMS/WhatsApp vendor. Today a mock provider logs the message; in
 * production a Termii adapter (Nigeria-focused delivery) implements the same
 * shape. Swapping vendors is a one-line change, no screen touched.
 */

export type Channel = "sms" | "whatsapp";

export interface OutgoingMessage {
  to: string; // guardian phone, E.164 or local
  channel: Channel;
  body: string;
}

export interface SendResult {
  ok: boolean;
  channel: Channel;
  to: string;
  providerRef?: string;
  error?: string;
}

export interface MessagingProvider {
  send(message: OutgoingMessage): Promise<SendResult>;
}

/**
 * Message copy follows the voice guide: respectful, clear, no hype, no blame.
 * We say "Outstanding balance" and "Guardian/Parent", never "debt".
 */
export const templates = {
  feeReminder(account: StudentAccount, schoolName: string): string {
    const name = `${account.student.firstName} ${account.student.lastName}`;
    return (
      `Good day. This is a reminder from ${schoolName}. ` +
      `${name} (${account.className}) has an outstanding balance of ` +
      `${formatNaira(account.outstanding)} for the term. ` +
      `Kindly arrange payment at your convenience. Thank you.`
    );
  },

  paymentConfirmation(
    guardianName: string,
    studentName: string,
    amount: number,
    receiptNo: string,
    newBalance: number,
    schoolName: string,
  ): string {
    const balanceLine =
      newBalance <= 0
        ? "Fees are now fully paid for the term. Thank you."
        : `Outstanding balance is now ${formatNaira(newBalance)}.`;
    return (
      `Payment of ${formatNaira(amount)} received for ${studentName}. ` +
      `Receipt ${receiptNo}. ${balanceLine}. ${schoolName}`
    );
  },
};
