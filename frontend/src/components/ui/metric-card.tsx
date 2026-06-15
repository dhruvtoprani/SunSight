import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
  tone?: "yellow" | "blue" | "green" | "violet";
}

const tones = {
  yellow: "before:bg-[#f5d547] text-[#f5d547]",
  blue: "before:bg-[#8ccff1] text-[#8ccff1]",
  green: "before:bg-[#75d7ab] text-[#75d7ab]",
  violet: "before:bg-[#b8a3ef] text-[#b8a3ef]",
};

export function MetricCard({ label, value, detail, icon, tone = "blue" }: MetricCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] p-4 before:absolute before:inset-x-0 before:top-0 before:h-px",
        tones[tone],
      )}
    >
      <div className="flex items-center justify-between gap-3 text-zinc-500">
        <span className="text-[10px] font-semibold uppercase tracking-[0.19em]">{label}</span>
        <span className="text-zinc-500">{icon}</span>
      </div>
      <div className="mt-3 font-mono text-[1.65rem] font-medium tracking-[-0.04em] text-zinc-50">{value}</div>
      {detail ? <div className="mt-1.5 min-h-4 text-xs leading-4 text-zinc-500">{detail}</div> : null}
    </div>
  );
}
