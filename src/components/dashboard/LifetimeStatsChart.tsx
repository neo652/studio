
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
import { ChartTooltipContent } from "@/components/ui/chart"; // Using shadcn's tooltip style

interface LifetimeStatsChartProps {
  stats: PlayerLifetimeStats[];
}

export function LifetimeStatsChart({ stats }: LifetimeStatsChartProps) {
  if (!stats || stats.length === 0) {
    return <p className="text-muted-foreground text-center py-4">No data available for chart.</p>;
  }

  // Sort stats for consistent chart display, e.g., by highest winnings first
  const sortedStats = React.useMemo(() => 
    [...stats].sort((a, b) => b.totalNetValueAllGames - a.totalNetValueAllGames),
    [stats]
  );

  // Calculate dynamic height based on number of players
  // Base height + per player height, with min/max
  const chartHeight = Math.max(200, Math.min(800, 50 + sortedStats.length * 35));

  return (
    <div style={{ width: "100%", height: chartHeight }} className="mt-6">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sortedStats}
          layout="vertical"
          margin={{
            top: 5,
            right: 30,
            left: 20, // Increased left margin for player names
            bottom: 5,
          }}
          barCategoryGap="20%" // Adds some space between bars
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
          <YAxis
            dataKey="playerName"
            type="category"
            width={100} // Adjust if player names are longer
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
            content={
              <ChartTooltipContent 
                formatter={(value, name, props) => {
                  if (props && props.payload) {
                    return [`${(props.payload.totalNetValueAllGames || 0).toLocaleString()} chips`, props.payload.playerName];
                  }
                  return [value, name];
                }} 
                hideLabel // We show player name in the formatted value
              />
            }
          />
          <Bar dataKey="totalNetValueAllGames" radius={[0, 5, 5, 0]}>
            {sortedStats.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.totalNetValueAllGames >= 0
                    ? "hsl(var(--chart-2))" // A positive color from theme
                    : "hsl(var(--destructive))" // A negative color from theme
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
