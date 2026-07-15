import { redirect } from "next/navigation";

export default async function LegacyReviewQueuePage({ searchParams }) {
  const params = await searchParams;
  redirect(params?.plan ? `/approvals?plan=${params.plan}` : "/approvals");
}
