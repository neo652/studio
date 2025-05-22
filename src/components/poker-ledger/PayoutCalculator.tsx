
"use client";

import { useState, useMemo } from "react";
import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Landmark, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Player } from "@/types/poker";

interface PayoutPlayer extends Player {
  percentageOfPot: number;
  suggestedPayout: number;
  manualAdjustment: number;
  finalPayout: number;
}

export function PayoutCalculator() {
  const { players, totalPot, adjustPayout } = usePokerLedger();
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});

  const totalChipsInPlay = useMemo(() => {
    return players.reduce((sum, player) => sum + player.chips, 0);
  }, [players]);

  const payoutData = useMemo((): PayoutPlayer[] => {
    return players.map(player => {
      const percentageOfPot = totalChipsInPlay > 0 ? (player.chips / totalChipsInPlay) : 0;
      const suggestedPayout = percentageOfPot * totalPot;
      const manualAdjustment = adjustments[player.id] || 0;
      const finalPayout = suggestedPayout + manualAdjustment;
      return {
        ...player,
        percentageOfPot,
        suggestedPayout,
        manualAdjustment,
        finalPayout,
      };
    }).sort((a,b) => b.finalPayout - a.finalPayout); // Sort by final payout descending
  }, [players, totalPot, totalChipsInPlay, adjustments]);

  const handleAdjustmentChange = (playerId: string, value: string) => {
    const amount = parseInt(value, 10);
    setAdjustments(prev => ({
      ...prev,
      [playerId]: isNaN(amount) ? 0 : amount,
    }));
  };

  // Note: The actual application of `adjustPayout` from context would typically be a one-time event
  // or when finalizing payouts. For this UI, it's represented by `manualAdjustment`.
  // If `adjustPayout` from context is to be used to *finalize* and log the adjustment,
  // there would need to be a "Confirm Adjustments" button.
  // For simplicity here, `manualAdjustment` is UI-only for calculation display.
  // To make it persistent, you would call `adjustPayout(player.id, newAdjustmentValue - oldAdjustmentValue)`
  // This example component focuses on calculation and display.
  // A "Finalize Payouts" button could iterate through players and call `adjustPayout` for non-zero adjustments.

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Landmark className="h-6 w-6 text-primary" />
          <CardTitle>Payouts</CardTitle>
        </div>
        <CardDescription>Calculate final payouts based on chip distribution.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-4 border rounded-lg bg-card/50 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Pot Value:</span>
            <span className="font-semibold text-lg text-accent">
              {totalPot.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Chips in Play:</span>
            <span className="font-semibold text-lg">
              {totalChipsInPlay.toLocaleString()}
            </span>
          </div>
        </div>

        {players.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No players in the game to calculate payouts.</p>
        ) : (
          <ScrollArea className="h-[300px] sm:h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Chips</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">% of Pot</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Suggested</TableHead>
                  <TableHead className="text-right">Adjustment</TableHead>
                  <TableHead className="text-right">Final Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutData.map((player) => (
                  <TableRow key={player.id} className="table-row-hover">
                    <TableCell className="font-medium">{player.name}</TableCell>
                    <TableCell className="text-right">{player.chips.toLocaleString()}</TableCell>
                    <TableCell className="text-right hidden sm:table-cell">{(player.percentageOfPot * 100).toFixed(2)}%</TableCell>
                    <TableCell className="text-right hidden md:table-cell">{player.suggestedPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right w-28">
                      <Input
                        type="number"
                        value={player.manualAdjustment}
                        onChange={(e) => handleAdjustmentChange(player.id, e.target.value)}
                        className="h-8 text-right"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold text-accent">
                      {player.finalPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
        <div className="mt-4 text-xs text-muted-foreground">
          <p>* Suggested payout is (Player Chips / Total Chips) * Total Pot Value.</p>
          <p>* Final Payout = Suggested Payout + Adjustment.</p>
          <p>* Use the 'Adjustment' field for side bets or manual corrections. These are not automatically logged as transactions unless a 'Finalize' mechanism is implemented.</p>
        </div>
      </CardContent>
    </Card>
  );
}
