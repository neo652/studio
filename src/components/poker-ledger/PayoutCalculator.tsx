
"use client";

import type { ChangeEvent } from 'react';
import { useMemo, useState, useEffect } from "react";
import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Landmark } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Player, SettlementPayment } from "@/types/poker";
import { roundTo } from "@/utils/math";
import { useToast } from '@/hooks/use-toast';

interface PayoutPlayer {
  id: string;
  name: string;
  totalInvested: number;
  finalChips: number; // Editable for payout calculation
  finalValue: number;
  netAmount: number;
}

export function PayoutCalculator() {
  const { players: contextPlayers, totalPot } = usePokerLedger();
  const { toast } = useToast();
  const [editablePlayers, setEditablePlayers] = useState<PayoutPlayer[]>([]);

  useEffect(() => {
    // Initialize or update editablePlayers when contextPlayers changes.
    // This effectively "resets" manual chip edits if the main player list changes.
    setEditablePlayers(
      contextPlayers.map(p => ({
        id: p.id,
        name: p.name,
        totalInvested: p.totalInvested,
        finalChips: p.chips, // Initialized from live game counts
        finalValue: 0, // Will be calculated
        netAmount: 0,  // Will be calculated
      }))
    );
  }, [contextPlayers]);

  const handleFinalChipChange = (playerId: string, event: ChangeEvent<HTMLInputElement>) => {
    const newChipString = event.target.value;
    let newChipCount: number;

    if (newChipString === "") {
      newChipCount = 0; // Allow clearing the input, treat as 0 chips
    } else {
      newChipCount = parseInt(newChipString, 10);
      if (isNaN(newChipCount) || newChipCount < 0) {
        toast({
          title: "Invalid Input",
          description: "Chip count must be a non-negative number.",
          variant: "destructive",
        });
        // Optionally, revert to previous value or don't update
        // For simplicity, we'll allow the invalid state in input, but calculations might ignore it or treat as 0
        // Or better, just don't set state if invalid and not empty
        if (newChipString !== "" && (isNaN(newChipCount) || newChipCount < 0)) return;
      }
    }
    
    setEditablePlayers(prev =>
      prev.map(p =>
        p.id === playerId ? { ...p, finalChips: isNaN(newChipCount) ? 0 : newChipCount } : p
      )
    );
  };

  const derivedPayoutData = useMemo(() => {
    const currentTotalChipsInPlay = editablePlayers.reduce((sum, player) => sum + (player.finalChips || 0), 0);
    const currentChipValue = (currentTotalChipsInPlay === 0 || totalPot === 0) ? 0 : totalPot / currentTotalChipsInPlay;

    const playersWithCalculations: PayoutPlayer[] = editablePlayers.map(player => {
      const finalValue = roundTo((player.finalChips || 0) * currentChipValue, 2);
      const netAmount = roundTo(finalValue - player.totalInvested, 2);
      return {
        ...player,
        finalValue,
        netAmount,
      };
    }).sort((a, b) => b.netAmount - a.netAmount); // Sort by net amount (winners first)

    // Settlement logic
    let debtors = playersWithCalculations
      .filter(p => p.netAmount < 0)
      .map(p => ({ id: p.id, name: p.name, amount: Math.abs(p.netAmount) }))
      .sort((a, b) => b.amount - a.amount);

    let creditors = playersWithCalculations
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
    
    return {
      totalChipsInPlay: currentTotalChipsInPlay,
      chipValue: currentChipValue,
      calculatedPlayers: playersWithCalculations,
      settlements,
    };
  }, [editablePlayers, totalPot]);


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Landmark className="h-6 w-6 text-primary" />
          <CardTitle>Final Payouts & Settlement</CardTitle>
        </div>
        <CardDescription>Enter final chip counts to calculate net results and who pays whom to settle.</CardDescription>
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
            <span className="text-muted-foreground">Total Chips (from inputs below):</span>
            <span className="font-semibold text-lg">
              {derivedPayoutData.totalChipsInPlay.toLocaleString()}
            </span>
          </div>
          {derivedPayoutData.chipValue > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Value Per Chip:</span>
              <span className="font-semibold text-sm">
                ${derivedPayoutData.chipValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
            </div>
          )}
        </div>

        {editablePlayers.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Add players in 'Player Management' to calculate payouts.</p>
        ) : (
          <>
            <h3 className="text-lg font-semibold mb-2">Player Net Results</h3>
            <p className="text-xs text-muted-foreground mb-3">
              * Edit chip counts below to reflect final stacks for settlement. These edits do not affect the main game log.
            </p>
            <ScrollArea className="h-[200px] sm:h-[250px] mb-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right w-24">Final Chips</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Invested ($)</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Final Value ($)</TableHead>
                    <TableHead className="text-right">Net ($)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {derivedPayoutData.calculatedPlayers.map((player) => (
                    <TableRow key={player.id} className="table-row-hover">
                      <TableCell className="font-medium">{player.name}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={player.finalChips}
                          onChange={(e) => handleFinalChipChange(player.id, e)}
                          className="h-8 text-right"
                          min="0"
                        />
                      </TableCell>
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

            {derivedPayoutData.settlements.length > 0 && (
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
                      {derivedPayoutData.settlements.map((payment) => (
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
             {derivedPayoutData.settlements.length === 0 && editablePlayers.length > 0 && derivedPayoutData.chipValue > 0 && (
              <p className="text-muted-foreground text-center py-4">All players broke even or no payments needed based on current chip counts.</p>
            )}
             {editablePlayers.length > 0 && derivedPayoutData.chipValue === 0 && derivedPayoutData.totalChipsInPlay > 0 && totalPot === 0 && (
                <p className="text-muted-foreground text-center py-4">Total pot is $0. Cannot calculate chip value or payouts.</p>
             )}
          </>
        )}
        <div className="mt-6 text-xs text-muted-foreground space-y-1">
          <p>* Final Chips = Manually entered chip count for each player at game end.</p>
          <p>* Final Value ($) = Player's Final Chips * Value Per Chip.</p>
          <p>* Net ($) = Final Value ($) - Total Invested ($).</p>
          <p>* Settlement Transactions show the payments needed to reconcile all player net amounts.</p>
        </div>
      </CardContent>
    </Card>
  );
}
