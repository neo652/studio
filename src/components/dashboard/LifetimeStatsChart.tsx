
"use client";

import * as React from "react";
import type { PlayerLifetimeStats } from "@/types/poker";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

interface LifetimeStatsChartProps {
  stats: PlayerLifetimeStats[];
}

const chartConfig: ChartConfig = {}; // Simplified definition

export function LifetimeStatsChart({ stats }: LifetimeStatsChartProps) {
  if (!stats || stats.length === 0) {
    return <p className="text-muted-foreground text-center py-4">No data available for chart.</p>;
  }

  const sortedStats = React.useMemo(() =>
    [...stats].sort((a, b) => b.totalNetValueAllGames - a.totalNetValueAllGames),
    [stats]
  );

  const chartHeight = Math.max(200, Math.min(800, 50 + sortedStats.length * 35));

  return (
    <div style={{ width: "100%", height: chartHeight }} className="mt-6">
      <ChartContainer config={chartConfig} className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sortedStats}
            layout="vertical"
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
            <YAxis
              dataKey="playerName"
              type="category"
              width={100}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
              content={
                <ChartTooltipContent
                  formatter={(value, name, props) => {
                    if (props && props.payload) {
                      return [\`\${(props.payload.totalNetValueAllGames || 0).toLocaleString()} chips\`, props.payload.playerName];
                    }
                    return [value, name];
                  }}
                  hideLabel
                />
              }
            />
            <Bar dataKey="totalNetValueAllGames" radius={[0, 5, 5, 0]}>
              {sortedStats.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.totalNetValueAllGames >= 0
                      ? "hsl(var(--chart-2))"
                      : "hsl(var(--destructive))"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
