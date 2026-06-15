"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface ProductionChartProps {
  monthlyProduction: number[];
}

export function ProductionChart({ monthlyProduction }: ProductionChartProps) {
  const data = MONTHS.map((month, index) => ({
    month,
    kwh: monthlyProduction[index] ?? 0,
  }));

  return (
    <div className="h-64 min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
          <XAxis dataKey="month" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(245, 213, 71, 0.07)" }}
            contentStyle={{
              background: "rgba(16, 19, 24, 0.96)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 14,
              color: "#f4f4f5",
              boxShadow: "0 18px 42px rgba(0, 0, 0, 0.28)",
            }}
            labelStyle={{ color: "#d4d4d8" }}
          />
          <Bar dataKey="kwh" name="kWh" radius={[7, 7, 0, 0]} fill="#f5d547" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
