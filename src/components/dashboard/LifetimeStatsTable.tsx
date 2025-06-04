
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
            <TableHead className="px-2 sm:px-4">Player</TableHead>
            <TableHead className="text-right px-2 sm:px-4">Games Played</TableHead>
            <TableHead className="text-right px-2 sm:px-4">Win/Loss Chips</TableHead>
            <TableHead className="text-right px-2 sm:px-4">(₹)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((playerStat) => (
            <TableRow key={playerStat.playerName} className="table-row-hover">
              <TableCell className="font-medium py-2 px-2 sm:px-4">{playerStat.playerName}</TableCell>
              <TableCell className="text-right py-2 px-2 sm:px-4">{playerStat.gamesPlayed.toLocaleString()}</TableCell>
              <TableCell className={`text-right font-semibold py-2 px-2 sm:px-4 ${playerStat.totalNetValueAllGames >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                {playerStat.totalNetValueAllGames.toLocaleString()}
              </TableCell>
              <TableCell className={`text-right font-semibold py-2 px-2 sm:px-4 ${playerStat.totalNetValueAllGames / 2 >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                {(playerStat.totalNetValueAllGames / 2).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
