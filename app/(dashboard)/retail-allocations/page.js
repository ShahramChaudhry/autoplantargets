import { redirect } from "next/navigation";

export default async function LegacyRetailAllocationsPage({ searchParams }) {
  const params = await searchParams;
  redirect(params?.plan ? `/allocations?plan=${params.plan}` : "/allocations");
}
