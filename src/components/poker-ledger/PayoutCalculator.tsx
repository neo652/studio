
"use client";

import type { ChangeEvent } from 'react';
import { useMemo, useState, useEffect } from "react";
import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Landmark, AlertTriangle, CheckCircle2 } from "lucide-react";
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
    setEditablePlayers(
      contextPlayers.map(p => ({
        id: p.id,
        name: p.name,
        totalInvested: p.totalInvested,
        finalChips: p.chips, 
        finalValue: 0, 
        netAmount: 0,  
      }))
    );
  }, [contextPlayers]);

  const handleFinalChipChange = (playerId: string, event: ChangeEvent<HTMLInputElement>) => {
    const newChipString = event.target.value;
    let newChipCount: number;

    if (newChipString === "") {
      newChipCount = 0; 
    } else {
      newChipCount = parseInt(newChipString, 10);
      if (isNaN(newChipCount) || newChipCount < 0) {
        toast({
          title: "Invalid Input",
          description: "Chip count must be a non-negative number.",
          variant: "destructive",
        });
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
    }).sort((a, b) => b.netAmount - a.netAmount);

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

      if (amountToTransfer > 0.005) { 
        settlements.push({
          id: `settlement-${keyId++}`,
          fromPlayerName: debtor.name,
          toPlayerName: creditor.name,
          amount: amountToTransfer,
        });

        debtor.amount = roundTo(debtor.amount - amountToTransfer, 2);
        creditor.amount = roundTo(creditor.amount - amountToTransfer, 2);
      }

      if (debtor.amount < 0.005) { 
        debtors.shift();
      }
      if (creditor.amount < 0.005) { 
        creditors.shift();
      }
    }
    
    // Calculate chip discrepancy assuming 1 chip = $1 for pot value comparison
    const chipDiscrepancy = currentTotalChipsInPlay - totalPot;

    return {
      totalChipsInPlay: currentTotalChipsInPlay,
      chipValue: currentChipValue,
      calculatedPlayers: playersWithCalculations,
      settlements,
      chipDiscrepancy,
    };
  }, [editablePlayers, totalPot]);

  const getDiscrepancyMessage = () => {
    const { chipDiscrepancy, totalChipsInPlay } = derivedPayoutData;

    if (totalPot === 0 && totalChipsInPlay === 0) {
      return <p className="text-xs text-muted-foreground">No pot value or chips entered.</p>;
    }
    
    if (chipDiscrepancy === 0) {
      return (
        <div className="flex items-center text-xs text-green-500">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          <span>Chip count matches total pot value.</span>
        </div>
      );
    } else if (chipDiscrepancy > 0) {
      return (
        <div className="flex items-center text-xs text-orange-500">
          <AlertTriangle className="h-3 w-3 mr-1" />
          <span>Chip Surplus: +{chipDiscrepancy.toLocaleString()} chips (More chips entered than pot value).</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-xs text-destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          <span>Chip Shortage: {chipDiscrepancy.toLocaleString()} chips (Fewer chips entered than pot value).</span>
        </div>
      );
    }
  };

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
          <div className="mt-1">
            {getDiscrepancyMessage()}
          </div>
          {derivedPayoutData.chipValue > 0 && (
            <div className="flex justify-between items-center mt-2">
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
                    <TableHead className="text-right w-28 sm:w-24">Final Chips</TableHead> {/* Adjusted width for better viewing */}
                    <TableHead className="text-right hidden sm:table-cell">Invested ($)</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Final Value ($)</TableHead>
                    <TableHead className="text-right">Net ($)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {derivedPayoutData.calculatedPlayers.map((player) => (
                    <TableRow key={player.id} className="table-row-hover">
                      <TableCell className="font-medium py-2">{player.name}</TableCell>
                      <TableCell className="text-right py-2">
                        <Input
                          type="number"
                          value={player.finalChips === 0 && !document.activeElement?.isSameNode(event?.target as Node) ? '' : player.finalChips} // Show empty string for 0 unless focused
                          onFocus={(e) => e.target.value === '0' ? e.target.value = '' : null} // Clear 0 on focus if it's 0
                          onBlur={(e) => e.target.value === '' ? handleFinalChipChange(player.id, { target: { value: '0' } } as ChangeEvent<HTMLInputElement>) : null} // Set to 0 on blur if empty
                          onChange={(e) => handleFinalChipChange(player.id, e)}
                          className="h-8 text-right w-full" // Ensure input takes full cell width
                          min="0"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell py-2">{player.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right hidden md:table-cell py-2">{player.finalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className={`text-right font-semibold py-2 ${player.netAmount >= 0 ? 'text-green-500' : 'text-destructive'}`}>
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
                          <TableCell className="py-2">{payment.fromPlayerName}</TableCell>
                          <TableCell className="py-2">{payment.toPlayerName}</TableCell>
                          <TableCell className="text-right font-medium py-2">
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
          <p>* Chip Discrepancy compares entered chips to the Total Pot Value (assuming initial $1 = 1 chip).</p>
        </div>
      </CardContent>
    </Card>
  );
}

