"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { LayoutAnalysis, LayoutMode } from "@/lib/types";

const LABELS: Record<LayoutMode, string> = {
  max_capacity: "Max Capacity",
  conservative: "Conservative",
  best_roi: "Best ROI",
};

interface LayoutComparisonProps {
  analyses: LayoutAnalysis[];
}

export function LayoutComparison({ analyses }: LayoutComparisonProps) {
  const data = analyses.map((analysis) => ({
    name: LABELS[analysis.layout.layout_mode],
    panels: analysis.layout.panel_count,
    kw: analysis.layout.system_size_kw_dc,
    payback: analysis.financial.simple_payback_years ?? 0,
  }));

  return (
    <div className="h-64 min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
          <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(215, 240, 255, 0.07)" }}
            contentStyle={{
              background: "rgba(16, 19, 24, 0.96)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 14,
              color: "#f4f4f5",
              boxShadow: "0 18px 42px rgba(0, 0, 0, 0.28)",
            }}
            labelStyle={{ color: "#d4d4d8" }}
          />
          <Legend wrapperStyle={{ color: "#a1a1aa", fontSize: 12 }} />
          <Bar dataKey="panels" name="Panels" fill="#8ccff1" radius={[7, 7, 0, 0]} />
          <Bar dataKey="kw" name="kW DC" fill="#f5d547" radius={[7, 7, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
