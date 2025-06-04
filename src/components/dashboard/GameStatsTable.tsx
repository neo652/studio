
"use client";

import type { PlayerInGameStats } from "@/types/poker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// ScrollArea import is no longer needed
// import { ScrollArea } from "@/components/ui/scroll-area";

interface GameStatsTableProps {
  stats: PlayerInGameStats[];
}

export function GameStatsTable({ stats }: GameStatsTableProps) {
  if (stats.length === 0) {
    return <p className="text-muted-foreground text-center py-4">No player data for this game or no game selected.</p>;
  }

  return (
    <div className="border rounded-md"> {/* Replaced ScrollArea with a div */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-2 sm:px-4">Player</TableHead>
            <TableHead className="text-right px-2 sm:px-4">Net Value (₹)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((playerStat) => (
            <TableRow key={playerStat.playerName} className="table-row-hover">
              <TableCell className="font-medium py-2 px-2 sm:px-4">{playerStat.playerName}</TableCell>
              <TableCell className={`text-right font-semibold py-2 px-2 sm:px-4 ${playerStat.netValue >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                {playerStat.netValue.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
