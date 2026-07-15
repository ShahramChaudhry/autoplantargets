import { redirect } from "next/navigation";

export default async function LegacyWorkflowStatusPage({ searchParams }) {
  const params = await searchParams;
  if (params?.plan) {
    redirect(`/monthly-planning/${params.plan}?step=submit`);
  }
  redirect("/monthly-planning");
}
