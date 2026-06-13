"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function AddAllocationForm({ type, periodId, options = {}, fields = [] }) {
  const [form, setForm] = useState(
    fields.reduce((acc, f) => ({ ...acc, [f.name]: f.default || "" }), { units: "" })
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const defaults = fields
      .filter((f) => f.default !== undefined && f.default !== "")
      .reduce((acc, f) => ({ ...acc, [f.name]: f.default }), {});

    const data = { ...defaults, ...form };

    if (data.units !== undefined && data.units !== "") {
      data.units = parseInt(data.units, 10) || 0;
    }
    if (data.target_units !== undefined && data.target_units !== "") {
      data.target_units = parseInt(data.target_units, 10) || 0;
    }
    delete data.undefined;

    try {
      const res = await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data, periodId }),
      });

      if (!res.ok) {
        const result = await res.json();
        alert(result.error || "Failed to add");
        return;
      }

      setForm(fields.reduce((acc, f) => ({ ...acc, [f.name]: "" }), { units: "" }));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
      {fields.map((field) => (
        <div key={field.name} className="space-y-1">
          <Label>{field.label}</Label>
          {field.type === "select" ? (
            <Select
              value={form[field.name]}
              onChange={(e) => updateField(field.name, e.target.value)}
              required
            >
              <option value="">Select...</option>
              {(options[field.optionsKey] || []).map((opt) => (
                <option key={opt.value || opt} value={opt.value || opt}>
                  {opt.label || opt}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              type={field.type || "text"}
              value={form[field.name]}
              onChange={(e) => updateField(field.name, e.target.value)}
              required={field.required !== false}
              placeholder={field.placeholder}
            />
          )}
        </div>
      ))}
      <Button type="submit" disabled={loading}>
        {loading ? "Adding..." : "Add"}
      </Button>
    </form>
  );
}
