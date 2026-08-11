import { redirect } from "next/navigation";

/** The ledger now lives inside the Payments hub. */
export default function LedgerRedirect() {
  redirect("/payments");
}
