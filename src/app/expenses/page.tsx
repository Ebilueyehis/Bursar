import { redirect } from "next/navigation";

/** Expenses now live inside the Payments hub. */
export default function ExpensesRedirect() {
  redirect("/payments");
}
