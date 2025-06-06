
"use client";

import React, { useState, useMemo } from "react";
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
  LabelList,
  Cell,
} from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardDescription } from "@/components/ui/card";

interface LifetimeStatsChartProps {
  stats: PlayerLifetimeStats[]; // Used to populate player dropdown
  allGamesData: SavedGameDocument[];
}

interface PlayerGameData {
  gameLabel: string;
  netAmount: number;
  gameDate: string; // For tooltip
}

// Helper to parse numeric fields robustly
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
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);

  const playerTrendData = useMemo(() => {
    if (!selectedPlayerName || !allGamesData || allGamesData.length === 0) {
      return [];
    }

    const playerGames: PlayerGameData[] = [];
    const sortedGames = [...allGamesData].sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());

    sortedGames.forEach((game, index) => {
      const playerDataInGame = game.players.find(p => p.name === selectedPlayerName);
      if (playerDataInGame) {
        let netAmount = 0;
        const pTotalInvested = parsePlayerNumericField(playerDataInGame.totalInvested) ?? 0;
        const pNetFromFinal = parsePlayerNumericField(playerDataInGame.netValueFromFinalChips);
        
        // Apply the new logic: if netValueFromFinalChips is null or 0, use -totalInvested
        if (pNetFromFinal === null || pNetFromFinal === 0) {
          netAmount = -pTotalInvested;
        } else {
          // Otherwise, use the non-zero pNetFromFinal
          netAmount = pNetFromFinal;
        }
        
        playerGames.push({
          gameLabel: `G${index + 1}`,
          netAmount: netAmount,
          gameDate: new Date(game.savedAt).toLocaleDateString(),
        });
      }
    });
    return playerGames;
  }, [selectedPlayerName, allGamesData]);

  const chartConfig = {
    netAmount: {
      label: "Net Win/Loss (Chips)",
    },
  } satisfies ChartConfig;

  const chartHeight = 350;

  if (stats.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4">
        No lifetime player data available to select players.
      </p>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Select onValueChange={setSelectedPlayerName} value={selectedPlayerName || ""}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="Select a player..." />
          </SelectTrigger>
          <SelectContent>
            {stats.map((player) => (
              <SelectItem key={player.playerName} value={player.playerName}>
                {player.playerName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedPlayerName && playerTrendData.length > 0 && (
             <CardDescription className="flex-1 text-center sm:text-left">
                Game-by-game net performance for {selectedPlayerName}.
            </CardDescription>
        )}
      </div>

      {!selectedPlayerName && (
        <p className="text-muted-foreground text-center py-8">
          Select a player to view their game-by-game performance.
        </p>
      )}

      {selectedPlayerName && playerTrendData.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          No game data found for {selectedPlayerName}.
        </p>
      )}

      {selectedPlayerName && playerTrendData.length > 0 && (
        <div style={{ width: "100%", height: `${chartHeight}px` }}>
          <ChartContainer config={chartConfig} className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={playerTrendData}
                margin={{
                  top: 20, // Increased top margin for LabelList
                  right: 20,
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
                            const originalPlayerName = selectedPlayerName || "Player";
                            const tooltipValue = typeof value === 'number' ? value : 0;
                            // props.payload contains the full data point, including gameDate
                            const gameDate = props.payload?.gameDate || "";
                            return [`${tooltipValue.toLocaleString()} chips (${gameDate})`, originalPlayerName];
                        }}
                        labelFormatter={(label) => `Game: ${label}`}
                    />
                  }
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="3 3"/>
                <Bar dataKey="netAmount" radius={[2, 2, 0, 0]}>
                  <LabelList 
                    dataKey="netAmount" 
                    position="top" 
                    formatter={(value: number) => value.toLocaleString()}
                    style={{ fontSize: '10px', fill: 'hsl(var(--foreground))' }}
                  />
                  {playerTrendData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.netAmount >= 0 ? "hsl(var(--chart-2))" : "hsl(var(--destructive))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}

