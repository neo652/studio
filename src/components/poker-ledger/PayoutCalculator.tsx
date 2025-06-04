
"use client";

import type { ChangeEvent } from 'react';
import { useMemo, useState, useEffect } from "react";
import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Landmark } from "lucide-react";
import type { SettlementPayment, Player as ContextPlayerType } from "@/types/poker";
import { roundTo } from "@/utils/math";
import { useToast } from '@/hooks/use-toast';
import * as React from "react";

interface PayoutPlayerDisplay {
  id: string;
  name: string;
  totalInvested: number;
  finalChipsInput: number; // Numeric value from input for calculation
  finalValue: number;
  netAmount: number;
}

const FIXED_CHIP_VALUE_INR = 1;
const CHIP_INPUT_REGEX = /^(|0|[1-9]\d*)$/; // Allows empty string, 0, or positive integers

export function PayoutCalculator() {
  const { players: contextPlayers, totalPot, updatePlayerFinalStats } = usePokerLedger();
  const { toast } = useToast();

  // inputStrings stores the string value of the input fields directly from user typing
  const [inputStrings, setInputStrings] = useState<Record<string, string>>({});

  useEffect(() => {
    // Initialize inputStrings based on contextPlayers' finalChips
    const newInputStringsInit: Record<string, string> = {};
    contextPlayers.forEach(playerFromContext => {
      const fcValue = playerFromContext.finalChips;
      if (typeof fcValue === 'number' && fcValue !== 0) {
        newInputStringsInit[playerFromContext.id] = fcValue.toString();
      } else {
        newInputStringsInit[playerFromContext.id] = ""; // Empty string for 0 or null/undefined
      }
    });
    setInputStrings(newInputStringsInit);
  }, [contextPlayers]);


  const handleChipDisplayChange = (playerId: string, currentDisplayValue: string) => {
    setInputStrings(prev => ({ ...prev, [playerId]: currentDisplayValue }));

    const playerFromContext = contextPlayers.find(p => p.id === playerId);
    if (!playerFromContext) return;

    let finalNumericValueForContext: number;
    let calculatedNetAmountForContext: number;

    if (CHIP_INPUT_REGEX.test(currentDisplayValue)) { // Valid integer string or empty
      finalNumericValueForContext = currentDisplayValue === "" ? 0 : parseInt(currentDisplayValue, 10);
      
      const finalChipValueOfInput = roundTo(finalNumericValueForContext * FIXED_CHIP_VALUE_INR, 2);
      const playerTotalInvested = playerFromContext.totalInvested;

      if (playerTotalInvested < 0) {
        calculatedNetAmountForContext = roundTo(finalChipValueOfInput + playerTotalInvested, 2);
      } else {
        calculatedNetAmountForContext = roundTo(finalChipValueOfInput - playerTotalInvested, 2);
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`PayoutCalc onChange Debug for ${playerFromContext.name} (ID: ${playerId}):
          - Input Display Value: "${currentDisplayValue}"
          - Parsed Final Chips (numeric): ${finalNumericValueForContext}
          - Player Total Invested (context): ${playerFromContext.totalInvested}
          - Calculated Net Amount (new logic): ${calculatedNetAmountForContext}`);
      }
      updatePlayerFinalStats(playerId, finalNumericValueForContext, calculatedNetAmountForContext);

    } else {
      // Input is invalid (e.g., "12a")
      // We don't update context here. Blur will handle resetting or toasting.
      // The input field will show the invalid string until blur.
      if (process.env.NODE_ENV === 'development') {
        console.log(`PayoutCalc onChange Debug for ${playerFromContext.name} (ID: ${playerId}): Invalid input "${currentDisplayValue}". Context not updated yet.`);
      }
    }
  };

  const handleFinalChipInputBlur = (playerId: string) => {
    const currentDisplayValue = inputStrings[playerId] ?? "";
    const playerFromContext = contextPlayers.find(p => p.id === playerId);
    if (!playerFromContext) return;

    let finalNumericValueForContext: number;
    let finalStringForDisplay: string;
    let calculatedNetAmountForContext: number;

    if (CHIP_INPUT_REGEX.test(currentDisplayValue) && currentDisplayValue !== "") {
      finalNumericValueForContext = parseInt(currentDisplayValue, 10);
      finalStringForDisplay = finalNumericValueForContext.toString(); // Canonical: "007" -> "7"
    } else { // Handles empty string or invalid input
      finalNumericValueForContext = 0;
      finalStringForDisplay = ""; 
      if (currentDisplayValue !== "" && !CHIP_INPUT_REGEX.test(currentDisplayValue)) {
        toast({
          title: "Invalid Chip Count",
          description: `Input for ${playerFromContext.name} ("${currentDisplayValue}") was invalid. Final chips set to 0.`,
          variant: "destructive",
        });
      }
    }
    
    // Update input string to canonical form
    setInputStrings(prev => ({ ...prev, [playerId]: finalStringForDisplay }));

    // Calculate net amount based on this finalized numeric value
    const finalChipValueOfInput = roundTo(finalNumericValueForContext * FIXED_CHIP_VALUE_INR, 2);
    const playerTotalInvested = playerFromContext.totalInvested;

    if (playerTotalInvested < 0) {
        calculatedNetAmountForContext = roundTo(finalChipValueOfInput + playerTotalInvested, 2);
      } else {
        calculatedNetAmountForContext = roundTo(finalChipValueOfInput - playerTotalInvested, 2);
      }

    if (process.env.NODE_ENV === 'development') {
        console.log(`PayoutCalc onBlur Debug for ${playerFromContext.name} (ID: ${playerId}):
          - Original Input: "${currentDisplayValue}", Finalized String: "${finalStringForDisplay}"
          - Final Chips (numeric): ${finalNumericValueForContext}
          - Player Total Invested (context): ${playerTotalInvested}
          - Calculated Net Amount (new logic): ${calculatedNetAmountForContext}`);
    }
    // Persist the potentially corrected/defaulted value to context
    updatePlayerFinalStats(playerId, finalNumericValueForContext, calculatedNetAmountForContext);
  };


  const derivedPayoutData = useMemo(() => {
    const playersWithCalculations: PayoutPlayerDisplay[] = contextPlayers.map(player => {
      const finalChipsFromContext = typeof player.finalChips === 'number' ? player.finalChips : 0;
      const finalChipValueForDisplay = roundTo(finalChipsFromContext * FIXED_CHIP_VALUE_INR, 2);
      const playerTotalInvested = player.totalInvested;
      
      let netAmount: number;
      if (typeof player.netValueFromFinalChips === 'number') {
        netAmount = player.netValueFromFinalChips; 
      } else {
        if (playerTotalInvested < 0) {
          netAmount = roundTo(finalChipValueForDisplay + playerTotalInvested, 2);
        } else {
          netAmount = roundTo(finalChipValueForDisplay - playerTotalInvested, 2);
        }
      }

      return {
        id: player.id,
        name: player.name,
        totalInvested: player.totalInvested,
        finalChipsInput: finalChipsFromContext, 
        finalValue: finalChipValueForDisplay,
        netAmount: netAmount,
      };
    }).sort((a, b) => {
        const indexA = contextPlayers.findIndex(p => p.id === a.id);
        const indexB = contextPlayers.findIndex(p => p.id === b.id);
        return indexA - indexB;
    });

    const currentTotalActualChips = playersWithCalculations.reduce((sum, p) => sum + p.finalChipsInput, 0);
    const expectedTotalChips = totalPot > 0 ? Math.round(totalPot / FIXED_CHIP_VALUE_INR) : 0;
    const chipDiscrepancy = currentTotalActualChips - expectedTotalChips;

    const valueOfActualChips = roundTo(currentTotalActualChips * FIXED_CHIP_VALUE_INR, 2);
    const monetaryDiscrepancy = roundTo(valueOfActualChips - totalPot, 2);

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
  }, [contextPlayers, totalPot]); 


  const getReconciliationMessages = () => {
    const {
      totalActualChipsInPlay,
      expectedTotalChips,
      chipDiscrepancy,
      valueOfActualChips,
      monetaryDiscrepancy,
    } = derivedPayoutData;

    if (contextPlayers.length === 0) {
      return <p className="text-xs text-muted-foreground">Add players to start.</p>;
    }

    if (totalActualChipsInPlay === 0 && totalPot === 0) {
      return <p className="text-xs text-muted-foreground">Enter final chip counts. Total pot is ₹0.00.</p>;
    }
    
    if (totalActualChipsInPlay === 0 && totalPot > 0) {
        return <p className="text-xs text-muted-foreground">Enter final chip counts to reconcile with the {totalPot.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} pot.</p>;
    }

    let chipStatusMessage = "";
    let chipStatusClass = "";
    if (chipDiscrepancy === 0) {
      chipStatusMessage = "Reconciled";
    } else if (chipDiscrepancy > 0) {
      chipStatusMessage = `Surplus: ${chipDiscrepancy.toLocaleString('en-IN')}`;
      chipStatusClass = "text-orange-500";
    } else { // chipDiscrepancy < 0
      chipStatusMessage = `Shortage: ${Math.abs(chipDiscrepancy).toLocaleString('en-IN')}`;
      chipStatusClass = "text-red-500";
    }

    let valueStatusMessage = "";
    let valueStatusClass = "";
    if (monetaryDiscrepancy === 0) {
      valueStatusMessage = "Reconciled";
    } else if (monetaryDiscrepancy > 0) {
      valueStatusMessage = `Surplus: ${monetaryDiscrepancy.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`;
      valueStatusClass = "text-orange-500";
    } else { // monetaryDiscrepancy < 0
      valueStatusMessage = `Shortage: ${Math.abs(monetaryDiscrepancy).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`;
      valueStatusClass = "text-red-500";
    }

    const showSettlementGuidance = totalActualChipsInPlay > 0 && derivedPayoutData.settlements.length > 0;

    return (
      <div className="space-y-0.5 text-xs text-muted-foreground min-h-[48px]">
        <p>
          Chips: Exp. <strong>{expectedTotalChips.toLocaleString('en-IN')}</strong> | Act. <strong>{totalActualChipsInPlay.toLocaleString('en-IN')}</strong>
          {(totalPot > 0 || totalActualChipsInPlay > 0) && <span className={`ml-1 ${chipStatusClass}`}>({chipStatusMessage})</span>}
        </p>
        <p>
          Value: Exp. <strong>{totalPot.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</strong> | Act. <strong>{valueOfActualChips.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</strong>
          {(totalPot > 0 || totalActualChipsInPlay > 0) && <span className={`ml-1 ${valueStatusClass}`}>({valueStatusMessage})</span>}
        </p>
        {showSettlementGuidance && 
          <p className="mt-1 text-xs">Settlements below use fixed chip value (amounts halved for convenience).</p>
        }
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
        <CardDescription>Enter final chip counts for net values and settlement. (Chip Value: ₹{FIXED_CHIP_VALUE_INR.toFixed(2)})</CardDescription>
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
            <div className="mb-6"> {/* Removed ScrollArea and fixed height */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2 px-2 sm:px-4">Player</TableHead>
                    <TableHead className="text-right w-28 sm:w-32 py-2 px-2 sm:px-4">Final Chips</TableHead>
                    <TableHead className="text-right hidden sm:table-cell py-2 px-2 sm:px-4">Invested (₹)</TableHead>
                    <TableHead className="text-right hidden md:table-cell py-2 px-2 sm:px-4">Final Value (₹)</TableHead>
                    <TableHead className="text-right py-2 px-2 sm:px-4">Net (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {derivedPayoutData.calculatedPlayers.map((player) => (
                    <TableRow key={player.id} className="table-row-hover">
                      <TableCell className="font-medium py-2 px-2 sm:px-4">{player.name}</TableCell>
                      <TableCell className="text-right py-2 px-2 sm:px-4">
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
                      <TableCell className="text-right hidden sm:table-cell py-2 px-2 sm:px-4">{player.totalInvested.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</TableCell>
                      <TableCell className="text-right hidden md:table-cell py-2 px-2 sm:px-4">{player.finalValue.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</TableCell>
                      <TableCell className={`text-right font-semibold py-2 px-2 sm:px-4 ${player.netAmount >= 0 ? 'text-green-500' : 'text-destructive'}`}>
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
                 <div> {/* Removed ScrollArea and fixed height */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="py-2 px-2 sm:px-4">From Player</TableHead>
                        <TableHead className="py-2 px-2 sm:px-4">To Player</TableHead>
                        <TableHead className="text-right py-2 px-2 sm:px-4">Amount (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {derivedPayoutData.settlements.map((payment) => (
                        <TableRow key={payment.id} className="table-row-hover">
                          <TableCell className="py-2 px-2 sm:px-4">{payment.fromPlayerName}</TableCell>
                          <TableCell className="py-2 px-2 sm:px-4">{payment.toPlayerName}</TableCell>
                          <TableCell className="text-right font-medium py-2 px-2 sm:px-4">
                            {payment.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            {derivedPayoutData.settlements.length === 0 && contextPlayers.length > 0 && derivedPayoutData.totalActualChipsInPlay > 0 && (
                 totalPot === 0 || derivedPayoutData.calculatedPlayers.every(p => Math.abs(p.netAmount) < 0.01) ? (
                    <p className="text-muted-foreground text-center py-4">All players broke even or no payments needed based on calculated net amounts.</p>
                ) : null
            )}
             {contextPlayers.length > 0 && derivedPayoutData.totalActualChipsInPlay === 0 && totalPot > 0 && (
                <p className="text-muted-foreground text-center py-4">Enter final chip counts to calculate payouts. Total actual chips currently zero.</p>
             )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
    

    