
"use client";

import React, { useState, useMemo } from "react";
import type { PlayerLifetimeStats, SavedGameDocument, Player as PlayerType } from "@/types/poker";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardDescription } from "@/components/ui/card";

interface LifetimeStatsChartProps {
  stats: PlayerLifetimeStats[]; // Used for player selection
  allGamesData: SavedGameDocument[]; // All game data to build trends
}

const chartConfig = {
  netAmount: {
    label: "Net Win/Loss (Chips)",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const DASHBOARD_CHIP_VALUE = 1; // Consistent with other dashboard calculations

const parsePlayerNumericField = (value: any): number | null => {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
};

export function LifetimeStatsChart({ stats, allGamesData }: LifetimeStatsChartProps) {
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);

  const playerTrendData = useMemo(() => {
    if (!selectedPlayerName || !allGamesData || allGamesData.length === 0) {
      return [];
    }

    const playerGames = allGamesData
      .filter(game => game.players.some(p => p.name === selectedPlayerName))
      .sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());

    if (playerGames.length === 0) return [];

    return playerGames.map((game, index) => {
      const playerDataInGame = game.players.find(p => p.name === selectedPlayerName);
      let netAmount = 0;

      if (playerDataInGame) {
        const pTotalInvested = parsePlayerNumericField(playerDataInGame.totalInvested) ?? 0;
        let gameNetVal: number;

        const pNetFromFinal = parsePlayerNumericField(playerDataInGame.netValueFromFinalChips);
        const pFinalChips = parsePlayerNumericField(playerDataInGame.finalChips);
        const pLiveChips = parsePlayerNumericField(playerDataInGame.chips) ?? 0;
        
        if (typeof pNetFromFinal === 'number') {
            gameNetVal = pNetFromFinal;
        } else if (typeof pFinalChips === 'number') {
            gameNetVal = (pFinalChips * DASHBOARD_CHIP_VALUE) - pTotalInvested;
        } else {
            gameNetVal = (pLiveChips * DASHBOARD_CHIP_VALUE) - pTotalInvested;
        }
        netAmount = gameNetVal;
      }
      
      return {
        gameLabel: `Game ${index + 1}`,
        netAmount: netAmount,
        gameDate: new Date(game.savedAt).toLocaleDateString(),
      };
    });
  }, [selectedPlayerName, allGamesData]);

  const uniquePlayerNames = useMemo(() => {
    return Array.from(new Set(stats.map(s => s.playerName))).sort();
  }, [stats]);

  if (!stats || stats.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4 mt-4">
        No lifetime player data available to display trends.
      </p>
    );
  }
  
  const chartHeight = 300; // Fixed height for line chart

  return (
    <div className="mt-6 space-y-4">
      <div>
        <label htmlFor="player-trend-selector" className="block text-sm font-medium text-muted-foreground mb-1">
          Select Player for Trend Line
        </label>
        <Select
          value={selectedPlayerName || ""}
          onValueChange={(value) => setSelectedPlayerName(value || null)}
        >
          <SelectTrigger id="player-trend-selector" className="w-full md:w-1/2 lg:w-1/3">
            <SelectValue placeholder="Select a player..." />
          </SelectTrigger>
          <SelectContent>
            {uniquePlayerNames.map(playerName => (
              <SelectItem key={playerName} value={playerName}>
                {playerName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedPlayerName && playerTrendData.length === 0 && (
        <p className="text-muted-foreground text-center py-4">
          No game data found for {selectedPlayerName}.
        </p>
      )}

      {selectedPlayerName && playerTrendData.length > 0 && (
        <>
          <CardDescription className="text-center">
            Game-by-Game Net Win/Loss Trend for {selectedPlayerName}
          </CardDescription>
          <div style={{ width: "100%", height: `${chartHeight}px` }}>
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={playerTrendData}
                  margin={{
                    top: 5,
                    right: 20,
                    left: 0, // Adjusted for Y-axis values
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
                    tickFormatter={(value) => value.toLocaleString()}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={
                      <ChartTooltipContent 
                        formatter={(value, name, props) => {
                            const payload = props.payload as any;
                            return [
                                `${value.toLocaleString()} chips (on ${payload?.gameDate || 'N/A'})`,
                                name === 'netAmount' ? chartConfig.netAmount.label : name,
                            ];
                        }}
                        labelFormatter={(label, payload) => {
                            if (payload && payload.length > 0 && payload[0].payload) {
                                return `Game: ${label} (${payload[0].payload.gameDate})`;
                            }
                            return label;
                        }}
                      />
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="netAmount"
                    stroke={chartConfig.netAmount.color}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </>
      )}
       {!selectedPlayerName && (
         <p className="text-muted-foreground text-center py-4">
            Select a player above to view their game-by-game performance trend.
          </p>
       )}
    </div>
  );
}
