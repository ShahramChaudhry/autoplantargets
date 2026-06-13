"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { formatPeriod } from "@/lib/utils";

export function PeriodSelector({ periods, currentId }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", e.target.value);
    router.push(`?${params.toString()}`);
  }

  return (
    <Select value={currentId || ""} onChange={handleChange} className="w-56">
      {periods.map((p) => (
        <option key={p.id} value={p.id}>
          {formatPeriod(p.month, p.year)}
        </option>
      ))}
    </Select>
  );
}
