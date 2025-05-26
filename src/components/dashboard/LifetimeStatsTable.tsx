
"use client";

import type { PlayerLifetimeStats } from "@/types/poker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface LifetimeStatsTableProps {
  stats: PlayerLifetimeStats[];
}

export function LifetimeStatsTable({ stats }: LifetimeStatsTableProps) {
  if (stats.length === 0) {
    return <p className="text-muted-foreground text-center py-4">No lifetime player data available.</p>;
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Games Played</TableHead>
            <TableHead className="text-right">Win/Loss (₹)</TableHead>
            <TableHead className="text-right">Settlement Share (₹)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((playerStat) => (
            <TableRow key={playerStat.playerName} className="table-row-hover">
              <TableCell className="font-medium">{playerStat.playerName}</TableCell>
              <TableCell className="text-right">{playerStat.gamesPlayed.toLocaleString()}</TableCell>
              <TableCell className={`text-right font-semibold ${playerStat.totalNetValueAllGames >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                {playerStat.totalNetValueAllGames.toLocaleString()}
              </TableCell>
              <TableCell className={`text-right font-semibold ${playerStat.totalNetValueAllGames / 2 >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                {(playerStat.totalNetValueAllGames / 2).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
