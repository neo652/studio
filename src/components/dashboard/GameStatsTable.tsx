
"use client";

import type { PlayerInGameStats } from "@/types/poker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GameStatsTableProps {
  stats: PlayerInGameStats[];
}

export function GameStatsTable({ stats }: GameStatsTableProps) {
  if (stats.length === 0) {
    return <p className="text-muted-foreground text-center py-4">No player data for this game or no game selected.</p>;
  }

  return (
    <ScrollArea className="h-[300px] sm:h-[400px] border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Invested (₹)</TableHead>
            <TableHead className="text-right">Final Chips</TableHead>
            <TableHead className="text-right">Net Value (₹)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((playerStat) => (
            <TableRow key={playerStat.playerName} className="table-row-hover">
              <TableCell className="font-medium">{playerStat.playerName}</TableCell>
              <TableCell className="text-right">{playerStat.totalInvested.toLocaleString()}</TableCell>
              <TableCell className="text-right">{playerStat.finalChips.toLocaleString()}</TableCell>
              <TableCell className={`text-right font-semibold ${playerStat.netValue >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                {playerStat.netValue.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
