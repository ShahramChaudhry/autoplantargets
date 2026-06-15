"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getArticleCodesForModel } from "@/lib/master-data";

export function ArticleAllocationForm({ plan, brand, modelAllocation, articles, editable = true }) {
  const router = useRouter();
  const [articleCode, setArticleCode] = useState("");
  const [units, setUnits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const modelArticles = articles.filter((a) => a.model_allocation_id === modelAllocation.id);
  const allocated = modelArticles.reduce((sum, a) => sum + a.units, 0);
  const remaining = modelAllocation.units - allocated;

  const usedCodes = useMemo(
    () => new Set(modelArticles.map((a) => a.article_code)),
    [modelArticles]
  );

  const availableCodes = useMemo(
    () => getArticleCodesForModel(brand, modelAllocation.model).filter((code) => !usedCodes.has(code)),
    [brand, modelAllocation.model, usedCodes]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!articleCode) {
      setError("Select an article code.");
      return;
    }

    const unitValue = parseInt(units, 10) || 0;
    if (unitValue <= 0) {
      setError("Units must be greater than zero.");
      return;
    }

    if (unitValue > remaining) {
      setError(`Cannot allocate ${unitValue} units. Only ${remaining} units remaining.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "articles",
          periodId: plan.id,
          data: {
            model_allocation_id: modelAllocation.id,
            article_code: articleCode,
            units: unitValue,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add article allocation");
        return;
      }

      setArticleCode("");
      setUnits("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!editable) {
    return null;
  }

  if (availableCodes.length === 0 && remaining > 0) {
    return (
      <p className="text-sm text-slate-500">
        All article codes for {modelAllocation.model} have been allocated.
      </p>
    );
  }

  if (remaining <= 0) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="space-y-1">
        <Label>Article Code</Label>
        <Select
          value={articleCode}
          onChange={(e) => setArticleCode(e.target.value)}
          required
          className="min-w-[12rem]"
        >
          <option value="">Select article code...</option>
          {availableCodes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Units</Label>
        <Input
          type="number"
          min="1"
          max={remaining}
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          placeholder={`Max ${remaining}`}
          required
          className="w-28"
        />
      </div>
      <Button type="submit" disabled={loading || !articleCode}>
        {loading ? "Adding..." : "Add Article Allocation"}
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
