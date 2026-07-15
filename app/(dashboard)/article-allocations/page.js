import { redirect } from "next/navigation";

export default async function LegacyArticleAllocationsPage({ searchParams }) {
  const params = await searchParams;
  if (params?.plan) {
    redirect(`/monthly-planning/${params.plan}?step=articles`);
  }
  redirect("/monthly-planning");
}
