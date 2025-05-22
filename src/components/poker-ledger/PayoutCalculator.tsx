
"use client";

import type { ChangeEvent } from 'react';
import { useMemo, useState, useEffect } from "react";
import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Landmark, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SettlementPayment } from "@/types/poker"; // Renamed Player to PayoutPlayer locally
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
  const [activeInputPlayerId, setActiveInputPlayerId] = useState<string | null>(null);


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

    if (newChipString === "" || newChipString === "-") { // Allow empty or just a minus for intermediate typing
      newChipCount = 0; 
    } else {
      newChipCount = parseInt(newChipString, 10);
      if (isNaN(newChipCount) || newChipCount < 0) {
        toast({
          title: "Invalid Input",
          description: "Chip count must be a non-negative number.",
          variant: "destructive",
        });
        // Do not return early if the input is just empty or a minus, allow intermediate states
        if (newChipString !== "" && newChipString !== "-" && (isNaN(newChipCount) || newChipCount < 0)) return;
        if (isNaN(newChipCount)) newChipCount = 0; // Default to 0 if still NaN (e.g. for empty string)
      }
    }
    
    setEditablePlayers(prev =>
      prev.map(p =>
        p.id === playerId ? { ...p, finalChips: Math.max(0, newChipCount) } : p // Ensure non-negative
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

    if (totalPot === 0 && totalChipsInPlay === 0 && editablePlayers.length > 0) {
      return <p className="text-xs text-muted-foreground">Enter final chip counts and ensure Total Pot Value is accurate.</p>;
    }
    if (editablePlayers.length === 0){ // Use editablePlayers here as contextPlayers might not have re-rendered yet
        return <p className="text-xs text-muted-foreground">Add players to start.</p>;
    }
    
    if (chipDiscrepancy === 0 && totalPot > 0) { // Only show success if pot is > 0
      return (
        <div className="flex items-center text-xs text-green-500">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          <span>Chip count matches total pot value. Calculations are balanced.</span>
        </div>
      );
    } else if (chipDiscrepancy > 0) {
      return (
        <div className="flex items-center text-xs text-orange-500">
          <AlertTriangle className="h-3 w-3 mr-1" />
          <span>Chip Surplus: +{chipDiscrepancy.toLocaleString()} chips. (More chips entered than pot value). Review entries.</span>
        </div>
      );
    } else if (chipDiscrepancy < 0) {
      return (
        <div className="flex items-center text-xs text-destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          <span>Chip Shortage: {chipDiscrepancy.toLocaleString()} chips. (Fewer chips entered than pot value). Review entries.</span>
        </div>
      );
    }
    return <p className="text-xs text-muted-foreground">Enter final chip counts to see reconciliation status.</p>;
  };
  
  const getChipInputValue = (player: PayoutPlayer) => {
    // If the input is active and the chip value is 0, allow empty string for typing.
    if (activeInputPlayerId === player.id && player.finalChips === 0) {
      return '';
    }
    // Otherwise, always represent 0 as '0' if not active, or the number as string.
    // For SSR consistency and non-focused state, 0 should be '0' or empty based on a consistent rule.
    // Let's show empty for 0 if not focused for cleaner look, and '0' or current value if focused/non-zero.
    if (!activeInputPlayerId && player.finalChips === 0) {
        return '';
    }
    return player.finalChips.toString();
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
          <div className="mt-1 min-h-[16px]"> {/* Added min-height to prevent layout shifts */}
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

        {contextPlayers.length === 0 ? ( 
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
                  {/* Ensure no whitespace between TableRow and TableHead or between TableHead elements */}
                  <TableRow><TableHead>Player</TableHead><TableHead className="text-right w-28 sm:w-32">Final Chips</TableHead><TableHead className="text-right hidden sm:table-cell">Invested ($)</TableHead><TableHead className="text-right hidden md:table-cell">Final Value ($)</TableHead><TableHead className="text-right">Net ($)</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {derivedPayoutData.calculatedPlayers.map((player) => (
                    <TableRow key={player.id} className="table-row-hover">
                      <TableCell className="font-medium py-2">{player.name}</TableCell>
                      <TableCell className="text-right py-2">
                        <Input
                          type="number"
                          value={getChipInputValue(player)}
                          onFocus={() => setActiveInputPlayerId(player.id)}
                          onBlur={() => {
                            setActiveInputPlayerId(null);
                            // If input is empty on blur, ensure it's treated as 0 by calling handleFinalChipChange
                            const currentChipObject = editablePlayers.find(p => p.id === player.id);
                            if (currentChipObject && (currentChipObject.finalChips === 0 || currentChipObject.finalChips.toString() === '')) {
                               // Check if the input field's actual current DOM value is empty
                               const inputElement = document.getElementById(`finalChips-${player.id}`) as HTMLInputElement; // Requires adding an ID to the input
                               if (inputElement && inputElement.value === '') {
                                   const syntheticEvent = { target: { value: '0' } } as ChangeEvent<HTMLInputElement>;
                                   handleFinalChipChange(player.id, syntheticEvent);
                               } else if (inputElement && inputElement.value !== '0' && currentChipObject.finalChips === 0){
                                  // if state is 0 but input has some other non-empty string which is not '0' (e.g. just typed '-')
                                  // ensure state becomes 0
                                   const syntheticEvent = { target: { value: '0' } } as ChangeEvent<HTMLInputElement>;
                                   handleFinalChipChange(player.id, syntheticEvent);
                               }
                            }
                          }}
                          onChange={(e) => handleFinalChipChange(player.id, e)}
                          id={`finalChips-${player.id}`} // Added ID for direct DOM access onBlur if needed (though ideally avoid)
                          className="h-8 text-right w-full"
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
                      {/* Ensure no whitespace between TableRow and TableHead or between TableHead elements */}
                      <TableRow><TableHead>From Player</TableHead><TableHead>To Player</TableHead><TableHead className="text-right">Amount ($)</TableHead></TableRow>
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
             {derivedPayoutData.settlements.length === 0 && editablePlayers.length > 0 && derivedPayoutData.chipValue > 0 && totalPot > 0 && (
              <p className="text-muted-foreground text-center py-4">All players broke even or no payments needed based on current chip counts.</p>
            )}
             {editablePlayers.length > 0 && derivedPayoutData.totalChipsInPlay > 0 && totalPot === 0 && (
                <p className="text-muted-foreground text-center py-4">Total pot is $0. Cannot calculate chip value or payouts.</p>
             )}
             {editablePlayers.length > 0 && derivedPayoutData.totalChipsInPlay === 0 && totalPot > 0 && ( /* Show if chips are 0 but pot exists */
                <p className="text-muted-foreground text-center py-4">Enter final chip counts. Total chips currently zero.</p>
             )}
          </>
        )}
        <div className="mt-6 text-xs text-muted-foreground space-y-1">
          <p>* Final Chips = Manually entered chip count for each player at game end.</p>
          <p>* Final Value ($) = Player's Final Chips * Value Per Chip.</p>
          <p>* Net ($) = Final Value ($) - Total Invested ($).</p>
          <p>* Settlement Transactions show the payments needed to reconcile all player net amounts.</p>
          <p>* Chip Discrepancy compares total entered final chips to the Total Pot Value.</p>
        </div>
      </CardContent>
    </Card>
  );
}

    