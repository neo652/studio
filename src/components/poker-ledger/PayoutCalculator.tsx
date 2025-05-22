
"use client";

import { useMemo } from "react";
import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Landmark, Users, VenetianMask } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Player, SettlementPayment } from "@/types/poker";
import { roundTo } from "@/utils/math";

interface DisplayPlayer extends Player {
  finalValue: number;
  netAmount: number;
}

export function PayoutCalculator() {
  const { players, totalPot } = usePokerLedger();

  const totalChipsInPlay = useMemo(() => {
    return players.reduce((sum, player) => sum + player.chips, 0);
  }, [players]);

  const chipValue = useMemo(() => {
    if (totalChipsInPlay === 0 || totalPot === 0) {
      return 0;
    }
    return totalPot / totalChipsInPlay;
  }, [totalPot, totalChipsInPlay]);

  const displayPlayers = useMemo((): DisplayPlayer[] => {
    return players.map(player => {
      const finalValue = roundTo(player.chips * chipValue, 2);
      const netAmount = roundTo(finalValue - player.totalInvested, 2);
      return {
        ...player,
        finalValue,
        netAmount,
      };
    }).sort((a,b) => b.netAmount - a.netAmount); // Sort by net amount (winners first)
  }, [players, chipValue]);

  const settlementTransactions = useMemo((): SettlementPayment[] => {
    if (players.length === 0 || chipValue === 0) {
      return [];
    }

    let debtors = displayPlayers
      .filter(p => p.netAmount < 0)
      .map(p => ({ id: p.id, name: p.name, amount: Math.abs(p.netAmount) }))
      .sort((a, b) => b.amount - a.amount);

    let creditors = displayPlayers
      .filter(p => p.netAmount > 0)
      .map(p => ({ id: p.id, name: p.name, amount: p.netAmount }))
      .sort((a, b) => b.amount - a.amount);

    const settlements: SettlementPayment[] = [];
    let keyId = 0;

    while (debtors.length > 0 && creditors.length > 0) {
      const debtor = debtors[0];
      const creditor = creditors[0];
      const amountToTransfer = roundTo(Math.min(debtor.amount, creditor.amount), 2);

      if (amountToTransfer > 0.005) { // Only record significant transactions
        settlements.push({
          id: `settlement-${keyId++}`,
          fromPlayerName: debtor.name,
          toPlayerName: creditor.name,
          amount: amountToTransfer,
        });

        debtor.amount = roundTo(debtor.amount - amountToTransfer, 2);
        creditor.amount = roundTo(creditor.amount - amountToTransfer, 2);
      }

      if (debtor.amount < 0.005) { // Effectively zero
        debtors.shift();
      }
      if (creditor.amount < 0.005) { // Effectively zero
        creditors.shift();
      }
    }
    return settlements;
  }, [displayPlayers, chipValue, players.length]);


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Landmark className="h-6 w-6 text-primary" />
          <CardTitle>Final Payouts & Settlement</CardTitle>
        </div>
        <CardDescription>Calculates each player's net result and who pays whom to settle the game.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-4 border rounded-lg bg-card/50 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Pot Value:</span>
            <span className="font-semibold text-lg text-accent">
              ${totalPot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Chips in Play:</span>
            <span className="font-semibold text-lg">
              {totalChipsInPlay.toLocaleString()}
            </span>
          </div>
          {chipValue > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Value Per Chip:</span>
              <span className="font-semibold text-sm">
                ${chipValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
            </div>
          )}
        </div>

        {players.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No players in the game to calculate payouts.</p>
        ) : (
          <>
            <h3 className="text-lg font-semibold mb-2">Player Net Results</h3>
            <ScrollArea className="h-[200px] sm:h-[250px] mb-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right">Chips</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Invested ($)</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Final Value ($)</TableHead>
                    <TableHead className="text-right">Net ($)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayPlayers.map((player) => (
                    <TableRow key={player.id} className="table-row-hover">
                      <TableCell className="font-medium">{player.name}</TableCell>
                      <TableCell className="text-right">{player.chips.toLocaleString()}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{player.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right hidden md:table-cell">{player.finalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className={`text-right font-semibold ${player.netAmount >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                        {player.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {settlementTransactions.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-2 mt-4">Settlement Transactions (Who Pays Whom)</h3>
                 <ScrollArea className="h-[150px] sm:h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>From Player</TableHead>
                        <TableHead>To Player</TableHead>
                        <TableHead className="text-right">Amount ($)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {settlementTransactions.map((payment) => (
                        <TableRow key={payment.id} className="table-row-hover">
                          <TableCell>{payment.fromPlayerName}</TableCell>
                          <TableCell>{payment.toPlayerName}</TableCell>
                          <TableCell className="text-right font-medium">
                            {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            )}
             {settlementTransactions.length === 0 && players.length > 0 && chipValue > 0 && (
              <p className="text-muted-foreground text-center py-4">All players broke even or no payments needed.</p>
            )}
          </>
        )}
        <div className="mt-6 text-xs text-muted-foreground space-y-1">
          <p>* Final Value ($) = Player Chips * Value Per Chip.</p>
          <p>* Net ($) = Final Value ($) - Total Invested ($).</p>
          <p>* Settlement Transactions show the payments needed to reconcile all player net amounts.</p>
          <p>* Ensure player chip counts in 'Player Management' are accurate before final settlement.</p>
        </div>
      </CardContent>
    </Card>
  );
}
