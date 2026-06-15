"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

function isHiddenField(field) {
  if (field.hidden) return true;
  if (field.type === "display" || field.type === "select") return false;
  return field.name?.endsWith("_id") ?? false;
}

function emptyFormState(editableFields) {
  return editableFields.reduce((acc, f) => ({ ...acc, [f.name]: f.default ?? "" }), { units: "" });
}

export function AddAllocationForm({ type, periodId, options = {}, fields = [], submitLabel = "Add" }) {
  const displayFields = fields.filter((f) => f.type === "display");
  const hiddenFields = fields.filter((f) => isHiddenField(f) && f.type !== "display");
  const editableFields = fields.filter((f) => !isHiddenField(f) && f.type !== "display");

  const [form, setForm] = useState(() => emptyFormState(editableFields));
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const defaults = hiddenFields
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

      setForm(emptyFormState(editableFields));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
      {displayFields.map((field) => (
        <div key={field.label} className="space-y-1">
          <Label>{field.label}</Label>
          <p className="min-h-9 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900">
            {field.value}
          </p>
        </div>
      ))}
      {editableFields.map((field) => (
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
        {loading ? "Adding..." : submitLabel}
      </Button>
    </form>
  );
}
