
"use client";

import type { ChangeEvent } from 'react';
import { useMemo, useState, useEffect } from "react";
import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Landmark, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SettlementPayment } from "@/types/poker";
import { roundTo } from "@/utils/math";
import { useToast } from '@/hooks/use-toast';
import * as React from "react";

interface PayoutPlayer {
  id: string;
  name: string;
  totalInvested: number;
  finalChips: number; // User-editable final chip count
  finalValue: number; // Calculated: finalChips * FIXED_CHIP_VALUE_INR
  netAmount: number; // Calculated: finalValue - totalInvested
}

const FIXED_CHIP_VALUE_INR = 1; // Chip value fixed at INR 1.00

export function PayoutCalculator() {
  const { players: contextPlayers, totalPot } = usePokerLedger();
  const { toast } = useToast();
  const [editablePlayers, setEditablePlayers] = useState<PayoutPlayer[]>([]);
  const [activeInputPlayerId, setActiveInputPlayerId] = useState<string | null>(null);

  useEffect(() => {
    // Initialize editablePlayers with finalChips set to 0 for manual input
    setEditablePlayers(
      contextPlayers.map(p => ({
        id: p.id,
        name: p.name,
        totalInvested: p.totalInvested,
        finalChips: 0, // Start with 0, user will input final counts
        finalValue: 0,
        netAmount: 0,
      }))
    );
  }, [contextPlayers]);

  const handleFinalChipChange = (playerId: string, event: ChangeEvent<HTMLInputElement>) => {
    const newChipString = event.target.value;
    let newChipCount: number;

    if (newChipString === "" || newChipString === "-") {
      // Allow empty or minus for intermediate input, treat as 0 for calculation
      newChipCount = 0;
    } else {
      newChipCount = parseInt(newChipString, 10);
      if (isNaN(newChipCount) || newChipCount < 0) {
         toast({
          title: "Invalid Input",
          description: "Chip count must be a non-negative number.",
          variant: "destructive",
        });
        // Prevent updating state if input is invalid and not just an empty/intermediate state
        if (newChipString !== "" && (isNaN(newChipCount) || newChipCount < 0)) return;
        if (isNaN(newChipCount)) newChipCount = 0; // If still NaN after checks, default to 0
      }
    }
    
    setEditablePlayers(prev =>
      prev.map(p =>
        p.id === playerId ? { ...p, finalChips: Math.max(0, newChipCount) } : p
      )
    );
  };

  const derivedPayoutData = useMemo(() => {
    // Sum of manually entered final chip counts
    const currentTotalActualChips = editablePlayers.reduce((sum, player) => sum + (player.finalChips || 0), 0);
    
    const playersWithCalculations: PayoutPlayer[] = editablePlayers.map(player => {
      const finalValue = roundTo((player.finalChips || 0) * FIXED_CHIP_VALUE_INR, 2);
      const netAmount = roundTo(finalValue - player.totalInvested, 2);
      return {
        ...player,
        finalValue,
        netAmount,
      };
    });

    // Settlement logic starts
    let debtors = playersWithCalculations
      .filter(p => p.netAmount < 0)
      .map(p => ({ id: p.id, name: p.name, amount: Math.abs(p.netAmount) }))
      .sort((a, b) => b.amount - a.amount); // Highest debtor first

    let creditors = playersWithCalculations
      .filter(p => p.netAmount > 0)
      .map(p => ({ id: p.id, name: p.name, amount: p.netAmount }))
      .sort((a, b) => b.amount - a.amount); // Highest creditor first

    const settlements: SettlementPayment[] = [];
    let keyId = 0;

    // Simplified settlement: iterate while there are debtors and creditors
    while (debtors.length > 0 && creditors.length > 0) {
      const debtor = debtors[0];
      const creditor = creditors[0];
      const amountToTransfer = roundTo(Math.min(debtor.amount, creditor.amount), 2);

      if (amountToTransfer > 0.005) { // Avoid tiny fractional payments
        settlements.push({
          id: `settlement-${keyId++}`,
          fromPlayerName: debtor.name,
          toPlayerName: creditor.name,
          amount: amountToTransfer,
        });
        debtor.amount = roundTo(debtor.amount - amountToTransfer, 2);
        creditor.amount = roundTo(creditor.amount - amountToTransfer, 2);
      }

      // Remove settled debtors/creditors
      if (debtor.amount < 0.005) debtors.shift();
      if (creditor.amount < 0.005) creditors.shift();
    }
    // Settlement logic ends
    
    // Calculate expected total chips based on the pot and fixed chip value
    const expectedTotalChipsFromPot = FIXED_CHIP_VALUE_INR > 0 ? roundTo(totalPot / FIXED_CHIP_VALUE_INR, 0) : 0;
    const chipCountDiscrepancy = roundTo(currentTotalActualChips - expectedTotalChipsFromPot, 0);

    // Calculate total value of actual chips entered and monetary discrepancy
    const totalValueFromActualChips = roundTo(currentTotalActualChips * FIXED_CHIP_VALUE_INR, 2);
    const monetaryDiscrepancy = roundTo(totalValueFromActualChips - totalPot, 2);

    return {
      totalActualChipsInPlay: currentTotalActualChips,
      calculatedPlayers: playersWithCalculations, // Use original order
      settlements,
      expectedTotalChipsFromPot,
      chipCountDiscrepancy,
      totalValueFromActualChips,
      monetaryDiscrepancy,
    };
  }, [editablePlayers, totalPot]);

  const getReconciliationMessages = () => {
    const { chipCountDiscrepancy, totalActualChipsInPlay, expectedTotalChipsFromPot, monetaryDiscrepancy, totalValueFromActualChips } = derivedPayoutData;

    if (editablePlayers.length === 0){
        return <p className="text-xs text-muted-foreground">Add players to start.</p>;
    }
    if (totalPot === 0 && totalActualChipsInPlay === 0 ) {
      return <p className="text-xs text-muted-foreground">Enter final chip counts. Total pot is ₹0.00 (Expected chips: 0).</p>;
    }
    
    const formattedChipDiscrepancy = Math.abs(chipCountDiscrepancy).toLocaleString('en-IN');
    const formattedMonetaryDiscrepancy = Math.abs(monetaryDiscrepancy).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

    let chipMessage, valueMessage;

    // Chip Discrepancy Message
    if (chipCountDiscrepancy === 0 && totalPot > 0) {
      chipMessage = (
        <div className="flex items-center text-xs text-green-500">
          <CheckCircle2 className="h-3 w-3 mr-1 flex-shrink-0" />
          <span>Entered chips ({totalActualChipsInPlay.toLocaleString('en-IN')}) match expected ({expectedTotalChipsFromPot.toLocaleString('en-IN')}). Balanced.</span>
        </div>
      );
    } else if (chipCountDiscrepancy > 0) {
      chipMessage = (
        <div className="flex items-center text-xs text-orange-500">
          <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
          <span>Chip Surplus: +{formattedChipDiscrepancy} chips. (Entered: {totalActualChipsInPlay.toLocaleString('en-IN')}, Expected: {expectedTotalChipsFromPot.toLocaleString('en-IN')}).</span>
        </div>
      );
    } else if (chipCountDiscrepancy < 0) {
      chipMessage = (
        <div className="flex items-center text-xs text-destructive">
          <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
          <span>Chip Shortage: {formattedChipDiscrepancy} chips. (Entered: {totalActualChipsInPlay.toLocaleString('en-IN')}, Expected: {expectedTotalChipsFromPot.toLocaleString('en-IN')}).</span>
        </div>
      );
    } else { // totalPot might be 0 or chip counts not entered yet
        chipMessage = <p className="text-xs text-muted-foreground">Enter final chip counts to see chip reconciliation. Expected chips: {expectedTotalChipsFromPot.toLocaleString('en-IN')}.</p>;
    }

    // Monetary Discrepancy Message
    if (monetaryDiscrepancy === 0 && totalValueFromActualChips > 0) { // Ensure some value exists to call it balanced
         valueMessage = (
            <div className="flex items-center text-xs text-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1 flex-shrink-0" />
                <span>Value of actual chips ({totalValueFromActualChips.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}) matches pot. Balanced.</span>
            </div>
        );
    } else if (monetaryDiscrepancy > 0) {
        valueMessage = (
            <div className="flex items-center text-xs text-orange-500">
                <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
                <span>Monetary Surplus: +{formattedMonetaryDiscrepancy}. (Value of actual chips: {totalValueFromActualChips.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}, Pot: {totalPot.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}).</span>
            </div>
        );
    } else if (monetaryDiscrepancy < 0) {
         valueMessage = (
            <div className="flex items-center text-xs text-destructive">
                <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
                <span>Monetary Shortfall: {formattedMonetaryDiscrepancy}. (Value of actual chips: {totalValueFromActualChips.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}, Pot: {totalPot.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}).</span>
            </div>
        );
    } else { // totalValueFromActualChips might be 0 or pot is 0
         valueMessage = <p className="text-xs text-muted-foreground">Enter final chip counts to see monetary reconciliation.</p>;
    }


    return <div className="space-y-1">{chipMessage}{valueMessage}</div>;
  };
  
  const getChipInputValue = (player: PayoutPlayer) => {
    // Show empty string if chips are 0 and input is not active, for better UX
    if (player.finalChips === 0 && activeInputPlayerId !== player.id) {
        return '';
    }
    return player.finalChips.toString();
  };

  const handleBlurFinalChips = (playerId: string) => {
    setActiveInputPlayerId(null);
    // Ensure that if input is left empty or invalid on blur, it resets to 0 if not already 0
    const playerChipData = editablePlayers.find(p => p.id === playerId);
    if (playerChipData) {
        // Check the actual input element's value, as state might not have updated for invalid chars
        const currentStringValue = (document.getElementById(`finalChips-${playerId}`) as HTMLInputElement)?.value;
        if (currentStringValue === "" || currentStringValue === "-" || (parseInt(currentStringValue, 10) < 0) || isNaN(parseInt(currentStringValue,10)) ) {
             if (playerChipData.finalChips !== 0) { // Only update if it's not already 0
                 handleFinalChipChange(playerId, { target: { value: '0' } } as ChangeEvent<HTMLInputElement>);
            }
        }
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Landmark className="h-6 w-6 text-primary" />
          <CardTitle>Final Payouts & Settlement</CardTitle>
        </div>
        <CardDescription>Enter final chip counts. Chip value for calculations is fixed at ₹{FIXED_CHIP_VALUE_INR.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Box */}
        <div className="mb-6 p-4 border rounded-lg bg-card/50 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Pot Value (Invested):</span>
            <span className="font-semibold text-lg text-accent">
              {totalPot.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
            </span>
          </div>
           <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Fixed Value Per Chip (for calculation):</span>
              <span className="font-semibold text-sm">
                {FIXED_CHIP_VALUE_INR.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Expected Total Chips (Pot / Fixed Value):</span>
            <span className="font-semibold text-lg">
              {derivedPayoutData.expectedTotalChipsFromPot.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Actual Chips (from inputs):</span>
            <span className="font-semibold text-lg">
              {derivedPayoutData.totalActualChipsInPlay.toLocaleString('en-IN')}
            </span>
          </div>
           <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Value of Actual Chips (@Fixed Value):</span>
            <span className="font-semibold text-lg">
              {derivedPayoutData.totalValueFromActualChips.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
            </span>
          </div>
          <div className="mt-1 min-h-[32px]"> {/* Adjusted min-height for two lines */}
            {getReconciliationMessages()}
          </div>
        </div>

        {/* Player Net Results Table */}
        {contextPlayers.length === 0 ? ( // Check contextPlayers as editablePlayers might be empty initially
          <p className="text-muted-foreground text-center py-4">Add players in 'Player Management' to calculate payouts.</p>
        ) : (
          <>
            <h3 className="text-lg font-semibold mb-2">Player Net Results</h3>
            <p className="text-xs text-muted-foreground mb-3">
              * Edit final chip counts below. Chip value fixed at ₹{FIXED_CHIP_VALUE_INR.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}.
            </p>
            <ScrollArea className="h-[200px] sm:h-[250px] mb-6">
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
                          type="text" // Changed to text for better visibility/editing of large numbers
                          value={getChipInputValue(player)}
                          onFocus={() => setActiveInputPlayerId(player.id)}
                          onBlur={() => handleBlurFinalChips(player.id)}
                          onChange={(e) => handleFinalChipChange(player.id, e)}
                          id={`finalChips-${player.id}`}
                          className="h-8 text-right w-full" // Ensure full width for responsiveness
                          placeholder="0" // Placeholder for when field is empty
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
            </ScrollArea>

            {/* Settlement Transactions Table */}
            {derivedPayoutData.settlements.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-2 mt-4">Settlement Transactions (Who Pays Whom)</h3>
                 <ScrollArea className="h-[150px] sm:h-[200px]">
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
            {/* Conditional messages for settlement display */}
             {derivedPayoutData.settlements.length === 0 && editablePlayers.length > 0 && derivedPayoutData.totalActualChipsInPlay > 0 && totalPot > 0 && derivedPayoutData.monetaryDiscrepancy === 0 && (
              <p className="text-muted-foreground text-center py-4">All players broke even or no payments needed based on calculated net amounts.</p>
            )}
            {derivedPayoutData.settlements.length > 0 && derivedPayoutData.monetaryDiscrepancy !== 0 && (
                <p className="text-muted-foreground text-center py-3 text-xs">
                    Note: Settlement payments balance the calculated Net (₹) amounts. The Monetary Discrepancy of <span className="font-semibold">{derivedPayoutData.monetaryDiscrepancy.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span> indicates a difference between the total pot and the total value of chips at the fixed rate.
                </p>
            )}
             {editablePlayers.length > 0 && derivedPayoutData.totalActualChipsInPlay > 0 && totalPot === 0 && (
                <p className="text-muted-foreground text-center py-4">Total pot is ₹0.00. Net amounts reflect chip values at ₹{FIXED_CHIP_VALUE_INR.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}/chip without investment comparison.</p>
             )}
             {editablePlayers.length > 0 && derivedPayoutData.totalActualChipsInPlay === 0 && totalPot > 0 && (
                <p className="text-muted-foreground text-center py-4">Enter final chip counts. Total actual chips currently zero.</p>
             )}
          </>
        )}
        {/* Help Text Section */}
        <div className="mt-6 text-xs text-muted-foreground space-y-1">
          <p>* Final Chips = Manually entered chip count for each player at game end.</p>
          <p>* Final Value (₹) = Player's Final Chips * ₹{FIXED_CHIP_VALUE_INR.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}.</p>
          <p>* Net (₹) = Final Value (₹) - Total Invested (₹).</p>
          <p>* Settlement Transactions show payments to reconcile player Net (₹) amounts.</p>
          <p>* Chip Discrepancy compares total actual chips entered to expected chips (Total Pot / Fixed Chip Value).</p>
          <p>* Monetary Discrepancy compares value of actual chips (at Fixed Chip Value) to Total Pot Value.</p>
        </div>
      </CardContent>
    </Card>
  );
}

