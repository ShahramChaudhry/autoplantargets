import { redirect } from "next/navigation";

export default async function LegacyModelAllocationsPage({ searchParams }) {
  const params = await searchParams;
  if (params?.plan) {
    redirect(`/monthly-planning/${params.plan}?step=models`);
  }
  redirect("/monthly-planning");
}
