
"use client";

import type { ChangeEvent } from 'react';
import { useMemo, useState, useEffect } from "react";
import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Landmark } from "lucide-react";
import type { SettlementPayment, Player as ContextPlayer } from "@/types/poker";
import { roundTo } from "@/utils/math";
import { useToast } from '@/hooks/use-toast';
import * as React from "react";

interface PayoutPlayer {
  id: string;
  name: string;
  totalInvested: number;
  finalChips: number; // Numeric state for calculation
  finalValue: number; 
  netAmount: number; 
}

const FIXED_CHIP_VALUE_INR = 1; 
const CHIP_INPUT_REGEX = /^(|0|[1-9]\d*)$/;

export function PayoutCalculator() {
  const { players: contextPlayers, totalPot, updatePlayerFinalStats } = usePokerLedger();
  const { toast } = useToast();
  
  // Local state for PayoutCalculator's player data, including potentially edited finalChips
  const [editablePlayers, setEditablePlayers] = useState<PayoutPlayer[]>([]);
  // Local state for the string value of input fields to allow flexible typing
  const [inputStrings, setInputStrings] = useState<Record<string, string>>({});

  useEffect(() => {
    const newEditablePlayers = contextPlayers.map(p => {
      // Use p.finalChips from context if available (e.g., game loaded), otherwise default to 0 for new calculation
      const initialFinalChips = typeof p.finalChips === 'number' ? p.finalChips : 0;
      return {
        id: p.id,
        name: p.name,
        totalInvested: p.totalInvested,
        finalChips: initialFinalChips, 
        // finalValue and netAmount will be calculated in derivedPayoutData
        finalValue: 0, 
        netAmount: 0,
      };
    });
    setEditablePlayers(newEditablePlayers);

    const newInputStrings: Record<string, string> = {};
    newEditablePlayers.forEach(p => {
      // If initialFinalChips is 0, input string should be empty, otherwise string of the number
      newInputStrings[p.id] = p.finalChips === 0 ? "" : p.finalChips.toString();
    });
    setInputStrings(newInputStrings);

  }, [contextPlayers]);


  const handleChipDisplayChange = (playerId: string, currentDisplayValue: string) => {
    setInputStrings(prev => ({ ...prev, [playerId]: currentDisplayValue }));

    // Update numeric finalChips in editablePlayers state immediately for reactive calculations
    // The onBlur handler will do final validation and push to context
    if (CHIP_INPUT_REGEX.test(currentDisplayValue)) {
      const newNumericValue = currentDisplayValue === "" ? 0 : parseInt(currentDisplayValue, 10);
      setEditablePlayers(prev =>
        prev.map(ep =>
          ep.id === playerId ? { ...ep, finalChips: newNumericValue } : ep
        )
      );
    } else if (currentDisplayValue !== "-" && currentDisplayValue !== "") {
      // If invalid but not empty or "-", keep current numeric value for now, blur will handle reset
      // This prevents calculations from breaking mid-type on an invalid character
    } else if (currentDisplayValue === "" || currentDisplayValue === "-") {
       setEditablePlayers(prev =>
        prev.map(ep =>
          ep.id === playerId ? { ...ep, finalChips: 0 } : ep
        )
      );
    }
  };

  const handleFinalChipInputBlur = (playerId: string) => {
    const currentDisplayValue = inputStrings[playerId] ?? "";
    let finalNumericValueForContext: number;
    let finalStringForDisplay: string;

    const playerForUpdate = editablePlayers.find(p => p.id === playerId); // Get current editable player
    const playerName = playerForUpdate?.name || 'selected player';

    if (CHIP_INPUT_REGEX.test(currentDisplayValue) && currentDisplayValue !== "") { 
      finalNumericValueForContext = parseInt(currentDisplayValue, 10); 
      finalStringForDisplay = finalNumericValueForContext.toString(); 
    } else { 
      finalNumericValueForContext = 0; // Reset to 0 if invalid or empty
      finalStringForDisplay = ""; // Keep input visually empty for 0

      if (currentDisplayValue !== "" && currentDisplayValue !== "-") { 
        toast({
          title: "Invalid Chip Count",
          description: `Input for ${playerName} was invalid. Final chips set to 0.`,
          variant: "destructive",
        });
      }
    }

    // Update local editablePlayers state first for immediate UI reflection if calculations depend on it
    let calculatedNetAmountForContext = 0;
    setEditablePlayers(prevPlayers => {
      return prevPlayers.map(p => {
        if (p.id === playerId) {
          const finalVal = roundTo(finalNumericValueForContext * FIXED_CHIP_VALUE_INR, 2);
          calculatedNetAmountForContext = roundTo(finalVal - p.totalInvested, 2);
          return { ...p, finalChips: finalNumericValueForContext, finalValue: finalVal, netAmount: calculatedNetAmountForContext };
        }
        return p;
      });
    });
    setInputStrings(prev => ({ ...prev, [playerId]: finalStringForDisplay }));
    
    // Update the central context
    // Pass null if finalNumericValueForContext is 0 and finalStringForDisplay is "" to signify "not explicitly set to zero"
    // However, current logic defaults to 0 if cleared.
    updatePlayerFinalStats(playerId, finalNumericValueForContext, calculatedNetAmountForContext);
  };


  const derivedPayoutData = useMemo(() => {
    const currentTotalActualChips = editablePlayers.reduce((sum, player) => sum + player.finalChips, 0);
    const expectedTotalChips = totalPot > 0 ? Math.round(totalPot / FIXED_CHIP_VALUE_INR) : 0;
    const chipDiscrepancy = currentTotalActualChips - expectedTotalChips;

    const valueOfActualChips = roundTo(currentTotalActualChips * FIXED_CHIP_VALUE_INR, 2);
    const monetaryDiscrepancy = roundTo(valueOfActualChips - totalPot, 2);

    const playersWithCalculations: PayoutPlayer[] = editablePlayers.map(player => {
      const finalValue = roundTo(player.finalChips * FIXED_CHIP_VALUE_INR, 2);
      const netAmount = roundTo(finalValue - player.totalInvested, 2);
      return {
        ...player,
        finalValue,
        netAmount,
      };
    }).sort((a, b) => { // Keep original player order
        const indexA = contextPlayers.findIndex(p => p.id === a.id);
        const indexB = contextPlayers.findIndex(p => p.id === b.id);
        return indexA - indexB;
    });

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

    let tempDebtors = JSON.parse(JSON.stringify(debtors));
    let tempCreditors = JSON.parse(JSON.stringify(creditors));

    while (tempDebtors.length > 0 && tempCreditors.length > 0) {
      const debtor = tempDebtors[0];
      const creditor = tempCreditors[0];
      const amountToTransfer = roundTo(Math.min(debtor.amount, creditor.amount), 2);

      if (amountToTransfer > 0.005) { 
        settlements.push({
          id: `settlement-${keyId++}`,
          fromPlayerName: debtor.name,
          toPlayerName: creditor.name,
          amount: roundTo(amountToTransfer / 2, 2), 
        });
        debtor.amount = roundTo(debtor.amount - amountToTransfer, 2);
        creditor.amount = roundTo(creditor.amount - amountToTransfer, 2);
      } else { 
        break;
      }

      if (debtor.amount < 0.005) tempDebtors.shift();
      if (creditor.amount < 0.005) tempCreditors.shift();
    }

    return {
      totalActualChipsInPlay: currentTotalActualChips,
      expectedTotalChips,
      chipDiscrepancy,
      valueOfActualChips,
      monetaryDiscrepancy,
      calculatedPlayers: playersWithCalculations,
      settlements,
    };
  }, [editablePlayers, totalPot, contextPlayers]); // Add contextPlayers dependency

  const getReconciliationMessages = () => {
    const {
      totalActualChipsInPlay,
      expectedTotalChips,
      chipDiscrepancy,
      valueOfActualChips,
      monetaryDiscrepancy
    } = derivedPayoutData;

    if (editablePlayers.length === 0){
        return <p className="text-xs text-muted-foreground">Add players to start.</p>;
    }

    let discrepancyChipMessage = "";
    if (totalActualChipsInPlay > 0 || totalPot > 0) {
        if (chipDiscrepancy === 0 && totalActualChipsInPlay === expectedTotalChips) {
            discrepancyChipMessage = "Chip counts reconcile with expected total chips.";
        } else if (chipDiscrepancy > 0) {
            discrepancyChipMessage = `Chip Surplus: ${chipDiscrepancy.toLocaleString('en-IN')} more chips entered than expected.`;
        } else { 
            discrepancyChipMessage = `Chip Shortage: ${Math.abs(chipDiscrepancy).toLocaleString('en-IN')} fewer chips entered than expected.`;
        }
    }

    let discrepancyMonetaryMessage = "";
     if (totalActualChipsInPlay > 0 || totalPot > 0) {
        if (monetaryDiscrepancy === 0 && valueOfActualChips === totalPot) {
            discrepancyMonetaryMessage = "Value of actual chips reconciles with total pot.";
        } else if (monetaryDiscrepancy > 0) {
            discrepancyMonetaryMessage = `Value Surplus: ${monetaryDiscrepancy.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} more in chip value than pot.`;
        } else { 
            discrepancyMonetaryMessage = `Value Shortage: ${Math.abs(monetaryDiscrepancy).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} less in chip value than pot.`;
        }
    }

    return (
        <div className="space-y-0.5 text-xs text-muted-foreground min-h-[64px]">
            {totalPot > 0 && <p>Fixed Value Per Chip: {FIXED_CHIP_VALUE_INR.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })}.</p>}
            {(totalPot > 0 || totalActualChipsInPlay > 0) && (
              <>
                <p>Expected Total Chips (from Pot): {expectedTotalChips.toLocaleString('en-IN')}.</p>
                {discrepancyChipMessage && <p className={chipDiscrepancy === 0 ? "" : (chipDiscrepancy > 0 ? "text-orange-500" : "text-red-500")}>{discrepancyChipMessage}</p>}
                <p>Value of Actual Chips Entered: {valueOfActualChips.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}.</p>
                {discrepancyMonetaryMessage && <p className={monetaryDiscrepancy === 0 ? "" : (monetaryDiscrepancy > 0 ? "text-orange-500" : "text-red-500")}>{discrepancyMonetaryMessage}</p>}
              </>
            )}
            {totalActualChipsInPlay === 0 && totalPot === 0 && <p>Enter final chip counts. Total pot is ₹0.00.</p>}
            {totalActualChipsInPlay > 0 && <p className="mt-1">Settlements below are based on the fixed chip value. (Displayed amounts are halved)</p>}
        </div>
    );
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Landmark className="h-6 w-6 text-primary" />
          <CardTitle>Final Payouts & Settlement</CardTitle>
        </div>
        <CardDescription>Enter final chip counts. Payouts are calculated based on a fixed chip value of ₹{FIXED_CHIP_VALUE_INR.toFixed(2)} per chip. These final chip counts will be saved with the game.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-4 border rounded-lg bg-card/50 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Pot Value (Invested):</span>
            <span className="font-semibold text-lg text-accent">
              {totalPot.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Actual Chips (from inputs):</span>
            <span className="font-semibold text-lg">
              {derivedPayoutData.totalActualChipsInPlay.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="mt-1">
            {getReconciliationMessages()}
          </div>
        </div>

        {contextPlayers.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Add players in 'Player Management' to calculate payouts.</p>
        ) : (
          <>
            <h3 className="text-lg font-semibold mb-2">Player Net Results</h3>
            <p className="text-xs text-muted-foreground mb-3">
              * Edit final chip counts below. Final Value and Net are based on fixed chip value of ₹{FIXED_CHIP_VALUE_INR.toFixed(2)}.
            </p>
            <div className="mb-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right w-28 sm:w-36">Final Chips</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Invested (₹)</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Final Value (₹)</TableHead>
                    <TableHead className="text-right">Net (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {derivedPayoutData.calculatedPlayers.map((player) => (
                    <TableRow key={player.id} className="table-row-hover">
                      <TableCell className="font-medium py-2">{player.name}</TableCell>
                      <TableCell className="text-right py-2">
                        <Input
                          type="text"
                          value={inputStrings[player.id] ?? ""}
                          onBlur={() => handleFinalChipInputBlur(player.id)}
                          onChange={(e) => handleChipDisplayChange(player.id, e.target.value)}
                          id={`finalChips-${player.id}`}
                          className="h-8 text-right w-full"
                          placeholder="" 
                        />
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell py-2">{player.totalInvested.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</TableCell>
                      <TableCell className="text-right hidden md:table-cell py-2">{player.finalValue.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</TableCell>
                      <TableCell className={`text-right font-semibold py-2 ${player.netAmount >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                        {player.netAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {derivedPayoutData.settlements.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-2 mt-4">Settlement Transactions (Who Pays Whom)</h3>
                 <div className="h-[150px] sm:h-[200px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>From Player</TableHead>
                        <TableHead>To Player</TableHead>
                        <TableHead className="text-right">Amount (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {derivedPayoutData.settlements.map((payment) => (
                        <TableRow key={payment.id} className="table-row-hover">
                          <TableCell className="py-2">{payment.fromPlayerName}</TableCell>
                          <TableCell className="py-2">{payment.toPlayerName}</TableCell>
                          <TableCell className="text-right font-medium py-2">
                            {payment.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
             {derivedPayoutData.settlements.length === 0 && editablePlayers.length > 0 && derivedPayoutData.totalActualChipsInPlay > 0 && (
                 totalPot === 0 || derivedPayoutData.calculatedPlayers.every(p => Math.abs(p.netAmount) < 0.01) ? (
                    <p className="text-muted-foreground text-center py-4">All players broke even or no payments needed based on calculated net amounts.</p>
                ) : null
            )}
             {editablePlayers.length > 0 && derivedPayoutData.totalActualChipsInPlay === 0 && totalPot > 0 && (
                <p className="text-muted-foreground text-center py-4">Enter final chip counts to calculate payouts. Total actual chips currently zero.</p>
             )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
