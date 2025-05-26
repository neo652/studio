
"use client";

import React, { useMemo } from "react";
import type { PlayerLifetimeStats, SavedGameDocument, Player as PlayerType } from "@/types/poker";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  Cell
} from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { CardDescription } from "@/components/ui/card";

interface LifetimeStatsChartProps {
  stats: PlayerLifetimeStats[]; // Used to get unique player names
  allGamesData: SavedGameDocument[];
}

const DASHBOARD_CHIP_VALUE = 1; // Each chip is worth ₹1 for dashboard calculations

// Helper to sanitize player names for use as dataKeys
const sanitizePlayerNameForKey = (name: string) => name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

// A simple palette of colors for player bars
const PLAYER_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  // Add more colors if you anticipate more players than this palette
  "#82ca9d", "#8884d8", "#ffc658", "#FF8042", "#00C49F", "#FFBB28"
];


const parsePlayerNumericField = (value: any): number | null => {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
};


export function LifetimeStatsChart({ stats, allGamesData }: LifetimeStatsChartProps) {
  const uniquePlayerNames = useMemo(() => {
    if (!stats || stats.length === 0) return [];
    return Array.from(new Set(stats.map(s => s.playerName))).sort();
  }, [stats]);

  const chartData = useMemo(() => {
    if (!allGamesData || allGamesData.length === 0 || uniquePlayerNames.length === 0) {
      return [];
    }

    // Sort games chronologically
    const sortedGames = [...allGamesData].sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());

    return sortedGames.map((game, index) => {
      const gameEntry: { gameLabel: string; [key: string]: any } = {
        gameLabel: `G${index + 1}`,
      };

      uniquePlayerNames.forEach(playerName => {
        const sanitizedKey = sanitizePlayerNameForKey(playerName);
        const playerDataInGame = game.players.find(p => p.name === playerName);

        if (playerDataInGame) {
          let netAmount = 0;
          const pTotalInvested = parsePlayerNumericField(playerDataInGame.totalInvested) ?? 0;
          const pNetFromFinal = parsePlayerNumericField(playerDataInGame.netValueFromFinalChips);
          const pFinalChips = parsePlayerNumericField(playerDataInGame.finalChips);
          const pLiveChips = parsePlayerNumericField(playerDataInGame.chips) ?? 0;

          if (typeof pNetFromFinal === 'number') {
            netAmount = pNetFromFinal;
          } else if (typeof pFinalChips === 'number') {
            netAmount = (pFinalChips * DASHBOARD_CHIP_VALUE) - pTotalInvested;
          } else {
            netAmount = (pLiveChips * DASHBOARD_CHIP_VALUE) - pTotalInvested;
          }
          gameEntry[sanitizedKey] = netAmount;
        } else {
          gameEntry[sanitizedKey] = 0; // Or null/undefined if you prefer gaps for players not in game
        }
      });
      return gameEntry;
    });
  }, [allGamesData, uniquePlayerNames]);

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    uniquePlayerNames.forEach((name, index) => {
      const sanitizedKey = sanitizePlayerNameForKey(name);
      config[sanitizedKey] = {
        label: name,
        color: PLAYER_COLORS[index % PLAYER_COLORS.length],
      };
    });
    return config;
  }, [uniquePlayerNames]);
  
  const chartHeight = 350;

  if (!allGamesData || allGamesData.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4">
        No game data available to display charts.
      </p>
    );
  }
  
  if (uniquePlayerNames.length === 0) {
     return (
      <p className="text-muted-foreground text-center py-4">
        No players found in lifetime stats to plot game-by-game performance.
      </p>
    );
  }


  return (
    <div className="space-y-4">
      {chartData.length === 0 && (
        <p className="text-muted-foreground text-center py-4">
          No game data available to display performance chart.
        </p>
      )}

      {chartData.length > 0 && (
        <>
          <CardDescription className="text-center my-2">
            Net Win/Loss per Game for All Players (Chips)
          </CardDescription>
          <div style={{ width: "100%", height: `${chartHeight}px` }}>
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{
                    top: 5, 
                    right: 30,
                    left: 0, 
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="gameLabel"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                    content={
                      <ChartTooltipContent 
                        formatter={(value, name, props) => {
                            // 'name' here is the sanitizedKey
                            const originalPlayerName = chartConfig[name]?.label || name;
                            const tooltipValue = typeof value === 'number' ? value : 0;
                            return [`${tooltipValue.toLocaleString()} chips`, originalPlayerName as string];
                        }}
                        labelFormatter={(label) => `Game: ${label}`}
                      />
                    }
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <Legend />
                  {uniquePlayerNames.map((playerName, index) => {
                    const sanitizedKey = sanitizePlayerNameForKey(playerName);
                    return (
                      <Bar 
                        key={sanitizedKey} 
                        dataKey={sanitizedKey} 
                        name={playerName} // Original name for legend
                        fill={PLAYER_COLORS[index % PLAYER_COLORS.length]} 
                        radius={[2, 2, 0, 0]}
                      />
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </>
      )}
    </div>
  );
}
