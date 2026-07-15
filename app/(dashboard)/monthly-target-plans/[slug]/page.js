import { redirect } from "next/navigation";

/** @deprecated Use /monthly-planning/[slug] */
export default async function LegacyPlanWorkspacePage({ params }) {
  const { slug } = await params;
  redirect(`/monthly-planning/${slug}`);
}
