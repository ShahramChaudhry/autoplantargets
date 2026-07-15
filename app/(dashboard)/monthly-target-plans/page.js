import { redirect } from "next/navigation";

/** @deprecated Use /monthly-planning */
export default function LegacyMonthlyTargetPlansPage() {
  redirect("/monthly-planning");
}
