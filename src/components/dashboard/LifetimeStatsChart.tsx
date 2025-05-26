
"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  Cell,
  LabelList
} from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardDescription } from "@/components/ui/card";

interface LifetimeStatsChartProps {
  stats: PlayerLifetimeStats[];
  allGamesData: SavedGameDocument[];
}

const DASHBOARD_CHIP_VALUE = 1; // Each chip is worth ₹1 for dashboard calculations

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

const chartConfig = {
  win: {
    label: "Win",
    color: "hsl(var(--chart-1))", 
  },
  loss: {
    label: "Loss",
    color: "hsl(var(--destructive))", 
  },
} satisfies ChartConfig;

export function LifetimeStatsChart({ stats, allGamesData }: LifetimeStatsChartProps) {
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const [playerGameData, setPlayerGameData] = useState<Array<{ gameLabel: string; netAmount: number; fill: string }>>([]);

  useEffect(() => {
    if (!selectedPlayerName || !allGamesData || allGamesData.length === 0) {
      setPlayerGameData([]);
      return;
    }

    const filteredGames = allGamesData
      .map(game => {
        const playerDataInGame = game.players.find(p => p.name === selectedPlayerName);
        if (!playerDataInGame) return null;

        let netAmount = 0;
        const pTotalInvested = parsePlayerNumericField(playerDataInGame.totalInvested) ?? 0;
        
        // Prioritize netValueFromFinalChips, then finalChips, then live chips
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
        
        return {
          savedAt: new Date(game.savedAt), // Ensure savedAt is a Date object for sorting
          netAmount,
        };
      })
      .filter(game => game !== null) as Array<{ savedAt: Date; netAmount: number }>;

    // Sort games chronologically
    filteredGames.sort((a, b) => a.savedAt.getTime() - b.savedAt.getTime());

    const chartData = filteredGames.map((game, index) => ({
      gameLabel: `G${index + 1}`, // Label games sequentially
      netAmount: game.netAmount,
      fill: game.netAmount >= 0 ? chartConfig.win.color : chartConfig.loss.color,
    }));

    setPlayerGameData(chartData);

  }, [selectedPlayerName, allGamesData]);

  const uniquePlayerNames = useMemo(() => {
    return Array.from(new Set(stats.map(s => s.playerName))).sort();
  }, [stats]);
  
  const chartHeight = 350;

  if (!stats || stats.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4">
        No lifetime player data available to display game-by-game stats.
      </p>
    );
  }

  return (
    <div className="space-y-4"> {/* Removed mt-6 from here */}
      <div>
        <label htmlFor="player-game-chart-selector" className="block text-sm font-medium text-muted-foreground mb-1">
          Select Player for Game-by-Game Performance
        </label>
        <Select
          value={selectedPlayerName || ""}
          onValueChange={(value) => setSelectedPlayerName(value || null)}
        >
          <SelectTrigger id="player-game-chart-selector" className="w-full md:w-1/2 lg:w-1/3">
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

      {selectedPlayerName && playerGameData.length === 0 && (
        <p className="text-muted-foreground text-center py-4">
          No game data found for {selectedPlayerName}.
        </p>
      )}

      {selectedPlayerName && playerGameData.length > 0 && (
        <>
          <CardDescription className="text-center my-2">
            Game-by-Game Net Win/Loss for {selectedPlayerName} (Chips)
          </CardDescription>
          <div style={{ width: "100%", height: `${chartHeight}px` }}>
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={playerGameData}
                  margin={{
                    top: 20, 
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
                            const tooltipValue = typeof value === 'number' ? value : 0;
                            const label = tooltipValue >= 0 ? chartConfig.win.label : chartConfig.loss.label;
                            return [`${tooltipValue.toLocaleString()} chips`, label];
                        }}
                        labelFormatter={(label) => `Game: ${label}`}
                      />
                    }
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <Bar dataKey="netAmount" radius={[4, 4, 0, 0]}>
                    {playerGameData.map((entry, index) => (
                      <Cell key={`cell-${entry.gameLabel}-${index}`} fill={entry.fill} />
                    ))}
                     <LabelList 
                        dataKey="netAmount" 
                        position="top" 
                        formatter={(value: number) => value !== 0 ? value.toLocaleString() : ""} // Hide label if value is 0
                        style={{ fill: 'hsl(var(--foreground))', fontSize: 11 }} 
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </>
      )}
       {!selectedPlayerName && (
         <p className="text-muted-foreground text-center py-4">
            Select a player above to view their game-by-game performance.
          </p>
       )}
    </div>
  );
}

    