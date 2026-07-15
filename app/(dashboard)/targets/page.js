import { redirect } from "next/navigation";

export default async function LegacyTargetsPage({ searchParams }) {
  const params = await searchParams;
  if (params?.plan) {
    redirect(`/monthly-planning/${params.plan}?step=targets`);
  }
  redirect("/monthly-planning");
}
