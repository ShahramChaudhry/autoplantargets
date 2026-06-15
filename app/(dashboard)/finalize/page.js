import { redirect } from "next/navigation";

export default function LegacyFinalizePage() {
  redirect("/workflow-status");
}
