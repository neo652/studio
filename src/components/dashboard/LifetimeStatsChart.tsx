
"use client";

import React from "react"; // Explicit import
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

const chartConfig: ChartConfig = {}; // Minimal config

export function LifetimeStatsChart({ stats }: LifetimeStatsChartProps) {
  if (!stats || stats.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4">
        No data available for chart.
      </p>
    );
  }

  // Ensure stats is always an array before sorting
  const validStats = Array.isArray(stats) ? stats : [];

  const sortedStats = React.useMemo(() => {
    return [...validStats].sort((a, b) => b.totalNetValueAllGames - a.totalNetValueAllGames);
  }, [validStats]);

  // Make chartHeight dynamic based on number of players, with min/max
  const chartHeight = Math.max(200, Math.min(800, 50 + (sortedStats.length || 0) * 35));

  return (
    <div style={{ width: "100%", height: `${chartHeight}px` }} className="mt-6">
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
              cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
              content={
                <ChartTooltipContent
                  formatter={(value, name, itemProps) => {
                    const statPayload = itemProps?.payload as PlayerLifetimeStats | undefined;
                    const displayValue = statPayload?.totalNetValueAllGames?.toLocaleString() ?? String(value);
                    const displayName = statPayload?.playerName ?? String(name);
                    return [`${displayValue} chips`, displayName];
                  }}
                  hideLabel
                />
              }
            />
            <Bar dataKey="totalNetValueAllGames" radius={[0, 5, 5, 0]}>
              {sortedStats.map((entry) => (
                <Cell
                  key={`cell-${entry.playerName}`}
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
