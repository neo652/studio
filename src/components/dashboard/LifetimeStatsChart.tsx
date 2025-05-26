
"use client";

import React, { useState, useMemo } from "react";
import type { PlayerLifetimeStats, SavedGameDocument } from "@/types/poker";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardDescription } from "@/components/ui/card";

interface LifetimeStatsChartProps {
  stats: PlayerLifetimeStats[];
  allGamesData: SavedGameDocument[];
}

const OUTCOME_CATEGORIES = [
  { label: "Big Loss (<-1000)", min: -Infinity, max: -1001, color: "hsl(var(--destructive))" },
  { label: "Mod. Loss (-1k to -501)", min: -1000, max: -501, color: "hsl(var(--destructive) / 0.8)" },
  { label: "Small Loss (-500 to -1)", min: -500, max: -1, color: "hsl(var(--destructive) / 0.6)" },
  { label: "Break Even (0)", min: 0, max: 0, color: "hsl(var(--muted-foreground))" },
  { label: "Small Win (1 to 500)", min: 1, max: 500, color: "hsl(var(--primary) / 0.6)" },
  { label: "Mod. Win (501 to 1k)", min: 501, max: 1000, color: "hsl(var(--primary) / 0.8)" },
  { label: "Big Win (>1000)", min: 1001, max: Infinity, color: "hsl(var(--primary))" },
];

const chartConfig = {
  count: {
    label: "Number of Games",
  },
  // Dynamically add categories to chartConfig for legend/tooltip colors
  ...OUTCOME_CATEGORIES.reduce((acc, cat) => {
    acc[cat.label] = { label: cat.label, color: cat.color };
    return acc;
  }, {} as Record<string, { label: string; color: string }>)
} satisfies ChartConfig;


const DASHBOARD_CHIP_VALUE = 1;

const parsePlayerNumericField = (value: any): number | null => {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
};

export function LifetimeStatsChart({ stats, allGamesData }: LifetimeStatsChartProps) {
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);

  const playerHistogramData = useMemo(() => {
    if (!selectedPlayerName || !allGamesData || allGamesData.length === 0) {
      return [];
    }

    const playerGameResults = allGamesData
      .map(game => {
        const playerDataInGame = game.players.find(p => p.name === selectedPlayerName);
        if (!playerDataInGame) return null;

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
        return netAmount;
      })
      .filter(result => typeof result === 'number') as number[];

    if (playerGameResults.length === 0) return [];

    const histogram = OUTCOME_CATEGORIES.map(category => ({
      category: category.label,
      count: playerGameResults.filter(net => net >= category.min && net <= category.max).length,
      fill: category.color,
    }));
    
    return histogram.filter(bin => bin.count > 0); // Only show bins with games

  }, [selectedPlayerName, allGamesData]);

  const uniquePlayerNames = useMemo(() => {
    return Array.from(new Set(stats.map(s => s.playerName))).sort();
  }, [stats]);
  
  const chartHeight = 350;

  if (!stats || stats.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4 mt-4">
        No lifetime player data available to display outcome distributions.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div>
        <label htmlFor="player-histogram-selector" className="block text-sm font-medium text-muted-foreground mb-1">
          Select Player for Outcome Distribution
        </label>
        <Select
          value={selectedPlayerName || ""}
          onValueChange={(value) => setSelectedPlayerName(value || null)}
        >
          <SelectTrigger id="player-histogram-selector" className="w-full md:w-1/2 lg:w-1/3">
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

      {selectedPlayerName && playerHistogramData.length === 0 && (
        <p className="text-muted-foreground text-center py-4">
          No game outcome data found for {selectedPlayerName} or all games are outside defined categories.
        </p>
      )}

      {selectedPlayerName && playerHistogramData.length > 0 && (
        <>
          <CardDescription className="text-center">
            Game Outcome Distribution for {selectedPlayerName}
          </CardDescription>
          <div style={{ width: "100%", height: `${chartHeight}px` }}>
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={playerHistogramData}
                  layout="vertical"
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20, // Increased left margin for category labels
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    allowDecimals={false} // Ensure whole numbers for count
                  />
                  <YAxis 
                    dataKey="category"
                    type="category"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12, width: 150 }} // Give more space for category labels
                    width={150} // Explicit width for YAxis
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                    content={
                      <ChartTooltipContent 
                        formatter={(value, name, props) => {
                            return [`${value} games`, chartConfig.count.label];
                        }}
                        labelFormatter={(label) => {
                            return `Category: ${label}`;
                        }}
                      />
                    }
                  />
                  {/* <Legend /> remove legend if only one series */}
                  <Bar dataKey="count" name={chartConfig.count.label} radius={[4, 4, 0, 0]}>
                    {/* LabelList can be added here if desired, to show count on bars */}
                     <LabelList dataKey="count" position="right" offset={5} style={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </>
      )}
       {!selectedPlayerName && (
         <p className="text-muted-foreground text-center py-4">
            Select a player above to view their game outcome distribution.
          </p>
       )}
    </div>
  );
}
