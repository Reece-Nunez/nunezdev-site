"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { DailyPoint } from "@/lib/googleAdsTransform";

/**
 * Daily spend (area, left axis) vs conversions (line, right axis) over the
 * selected window. Two axes because spend is in dollars and conversions are a
 * small count — sharing one axis would flatten the conversions line.
 */
export default function AdsTrendChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickFormatter={(d: string) => d.slice(5)} // MM-DD
          minTickGap={20}
        />
        <YAxis
          yAxisId="cost"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickFormatter={(v: number) => `$${v}`}
          width={48}
        />
        <YAxis
          yAxisId="conv"
          orientation="right"
          tick={{ fontSize: 11, fill: "#64748b" }}
          width={32}
          allowDecimals={false}
        />
        <Tooltip
          formatter={(value: number, name: string) =>
            name === "Spend" ? [`$${value.toFixed(2)}`, name] : [value, name]
          }
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Area
          yAxisId="cost"
          type="monotone"
          dataKey="cost"
          name="Spend"
          stroke="#2563eb"
          fill="#dbeafe"
          strokeWidth={2}
        />
        <Line
          yAxisId="conv"
          type="monotone"
          dataKey="conversions"
          name="Conversions"
          stroke="#16a34a"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
