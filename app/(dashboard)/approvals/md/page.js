import { redirect } from "next/navigation";

export default function LegacyMDApprovalPage() {
  redirect("/approval-queue");
}
