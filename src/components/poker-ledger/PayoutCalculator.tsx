
"use client";

import type { ChangeEvent } from 'react';
import { useMemo, useState, useEffect } from "react";
import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Landmark } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area"; // Still used for settlements
import type { SettlementPayment } from "@/types/poker";
import { roundTo } from "@/utils/math";
import { useToast } from '@/hooks/use-toast';
import * as React from "react";

interface PayoutPlayer {
  id: string;
  name: string;
  totalInvested: number;
  finalChips: number; 
  finalValue: number; 
  netAmount: number; 
}

const FIXED_CHIP_VALUE_INR = 1; 

const CHIP_INPUT_REGEX = /^(|0|[1-9]\d*)$/;


export function PayoutCalculator() {
  const { players: contextPlayers, totalPot } = usePokerLedger();
  const { toast } = useToast();
  const [editablePlayers, setEditablePlayers] = useState<PayoutPlayer[]>([]);
  const [inputStrings, setInputStrings] = useState<Record<string, string>>({});


  useEffect(() => {
    const newEditablePlayers = contextPlayers.map(p => ({
      id: p.id,
      name: p.name,
      totalInvested: p.totalInvested,
      finalChips: 0, 
      finalValue: 0,
      netAmount: 0,
    }));
    setEditablePlayers(newEditablePlayers);

    const newInputStrings: Record<string, string> = {};
    newEditablePlayers.forEach(p => {
      newInputStrings[p.id] = ""; 
    });
    setInputStrings(newInputStrings);

  }, [contextPlayers]);


  const handleChipDisplayChange = (playerId: string, currentDisplayValue: string) => {
    setInputStrings(prev => ({ ...prev, [playerId]: currentDisplayValue }));

    if (currentDisplayValue === "-") {
        setEditablePlayers(prev => prev.map(p => p.id === playerId && p.finalChips !== 0 ? { ...p, finalChips: 0 } : p));
        return;
    }

    if (CHIP_INPUT_REGEX.test(currentDisplayValue)) {
      const newNumericValue = currentDisplayValue === "" ? 0 : parseInt(currentDisplayValue, 10);
      setEditablePlayers(prev =>
        prev.map(p =>
          p.id === playerId ? { ...p, finalChips: newNumericValue } : p
        )
      );
    }
  };

  const handleFinalChipInputBlur = (playerId: string) => {
    const currentDisplayValue = inputStrings[playerId] ?? "";
    let finalNumericValue: number;
    let finalStringForDisplay: string;

    const player = editablePlayers.find(p => p.id === playerId);
    const playerName = player?.name || 'selected player';

    if (CHIP_INPUT_REGEX.test(currentDisplayValue) && currentDisplayValue !== "") { 
      finalNumericValue = parseInt(currentDisplayValue, 10); 
      finalStringForDisplay = finalNumericValue.toString(); 
    } else { 
      finalNumericValue = 0;
      finalStringForDisplay = ""; 

      if (currentDisplayValue !== "" && currentDisplayValue !== "-") { 
        toast({
          title: "Invalid Chip Count",
          description: `Input for ${playerName} was invalid and has been reset to empty (0 chips).`,
          variant: "destructive",
        });
      }
    }

    setEditablePlayers(prevPlayers =>
      prevPlayers.map(p =>
        p.id === playerId ? { ...p, finalChips: finalNumericValue } : p
      )
    );
    setInputStrings(prev => ({ ...prev, [playerId]: finalStringForDisplay }));
  };


  const derivedPayoutData = useMemo(() => {
    const currentTotalActualChips = editablePlayers.reduce((sum, player) => sum + (player.finalChips || 0), 0);
    const expectedTotalChips = totalPot > 0 ? Math.round(totalPot / FIXED_CHIP_VALUE_INR) : 0;
    const chipDiscrepancy = currentTotalActualChips - expectedTotalChips;

    const valueOfActualChips = roundTo(currentTotalActualChips * FIXED_CHIP_VALUE_INR, 2);
    const monetaryDiscrepancy = roundTo(valueOfActualChips - totalPot, 2);

    const playersWithCalculations: PayoutPlayer[] = editablePlayers.map(player => {
      const finalValue = roundTo((player.finalChips || 0) * FIXED_CHIP_VALUE_INR, 2);
      const netAmount = roundTo(finalValue - player.totalInvested, 2);
      return {
        ...player,
        finalValue,
        netAmount,
      };
    }).sort((a, b) => {
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

      if (amountToTransfer > 0.005) { // Avoid tiny float issues
        settlements.push({
          id: `settlement-${keyId++}`,
          fromPlayerName: debtor.name,
          toPlayerName: creditor.name,
          amount: roundTo(amountToTransfer / 2, 2), // Halved amount for display
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
  }, [editablePlayers, totalPot, contextPlayers]);

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
    if (totalActualChipsInPlay > 0 || totalPot > 0) { // Only show if there's data
        if (chipDiscrepancy === 0 && totalActualChipsInPlay === expectedTotalChips) {
            discrepancyChipMessage = "Chip counts reconcile with expected total chips.";
        } else if (chipDiscrepancy > 0) {
            discrepancyChipMessage = `Chip Surplus: ${chipDiscrepancy.toLocaleString('en-IN')} more chips entered than expected.`;
        } else { // chipDiscrepancy < 0
            discrepancyChipMessage = `Chip Shortage: ${Math.abs(chipDiscrepancy).toLocaleString('en-IN')} fewer chips entered than expected.`;
        }
    }

    let discrepancyMonetaryMessage = "";
     if (totalActualChipsInPlay > 0 || totalPot > 0) { // Only show if there's data
        if (monetaryDiscrepancy === 0 && valueOfActualChips === totalPot) {
            discrepancyMonetaryMessage = "Value of actual chips reconciles with total pot.";
        } else if (monetaryDiscrepancy > 0) {
            discrepancyMonetaryMessage = `Value Surplus: ${monetaryDiscrepancy.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} more in chip value than pot.`;
        } else { // monetaryDiscrepancy < 0
            discrepancyMonetaryMessage = `Value Shortage: ${Math.abs(monetaryDiscrepancy).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} less in chip value than pot.`;
        }
    }

    return (
        <div className="space-y-0.5 text-xs text-muted-foreground min-h-[64px]"> {/* min-h to reduce layout shift */}
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
            {totalActualChipsInPlay > 0 && <p className="mt-1">Settlements below are based on the fixed chip value.</p>}
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
        <CardDescription>Enter final chip counts. Payouts are calculated based on a fixed chip value of ₹{FIXED_CHIP_VALUE_INR.toFixed(2)} per chip.</CardDescription>
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
            <div className="mb-6"> {/* Wrapper for table to retain margin */}
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
                          type="text" // Changed to text
                          value={inputStrings[player.id] ?? ""}
                          onBlur={() => handleFinalChipInputBlur(player.id)}
                          onChange={(e) => handleChipDisplayChange(player.id, e.target.value)}
                          id={`finalChips-${player.id}`}
                          className="h-8 text-right w-full"
                          placeholder="" // Empty placeholder
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
                 <ScrollArea className="h-[150px] sm:h-[200px]"> {/* ScrollArea kept for settlements */}
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
                </ScrollArea>
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
        {/* Removed the help text section from here */}
      </CardContent>
    </Card>
  );
}
