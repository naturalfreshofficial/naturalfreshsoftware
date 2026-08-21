import { redirect } from "next/navigation";

export const metadata = {
  title: "Sales & Revenue Reports - Retailnext",
  description: "Date-wise sales reports, revenue statistics, payment breakdown, and invoices",
};

export default function ReportsPage() {
  redirect("/invoices");
}
