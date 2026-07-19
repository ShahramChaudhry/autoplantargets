import { DevSwitchUser } from "@/components/layout/dev-switch-user";
import { ClearPlansButton } from "@/components/plan/clear-plans-button";

export function Header({ title, description }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <DevSwitchUser />
        <ClearPlansButton />
      </div>
    </div>
  );
}
