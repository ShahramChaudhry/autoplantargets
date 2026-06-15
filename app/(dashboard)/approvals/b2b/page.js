import { redirect } from "next/navigation";

export default function LegacyB2BApprovalPage() {
  redirect("/review-queue");
}
