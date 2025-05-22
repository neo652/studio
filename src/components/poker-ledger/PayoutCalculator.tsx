
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

interface PayoutPlayer {
  id: string;
  name: string;
  totalInvested: number;
  finalChips: number;
  finalValue: number;
  netAmount: number;
}

const FIXED_CHIP_VALUE_INR = 1.0;

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
        finalChips: 0, // Initialize finalChips to 0 to be empty by default
        finalValue: 0,
        netAmount: 0,
      }))
    );
  }, [contextPlayers]);

  const handleFinalChipChange = (playerId: string, event: ChangeEvent<HTMLInputElement>) => {
    const newChipString = event.target.value;
    let newChipCount: number;

    if (newChipString === "" || newChipString === "-") {
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
        if (isNaN(newChipCount)) newChipCount = 0;
      }
    }
    
    setEditablePlayers(prev =>
      prev.map(p =>
        p.id === playerId ? { ...p, finalChips: Math.max(0, newChipCount) } : p
      )
    );
  };

  const derivedPayoutData = useMemo(() => {
    const currentTotalChipsInPlay = editablePlayers.reduce((sum, player) => sum + (player.finalChips || 0), 0);
    
    const playersWithCalculations: PayoutPlayer[] = editablePlayers.map(player => {
      const finalValue = roundTo((player.finalChips || 0) * FIXED_CHIP_VALUE_INR, 2);
      const netAmount = roundTo(finalValue - player.totalInvested, 2);
      return {
        ...player,
        finalValue,
        netAmount,
      };
    }); // Removed sorting: .sort((a, b) => b.netAmount - a.netAmount);

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

      if (amountToTransfer > 0.005) { // Threshold to avoid tiny settlements due to floating point
        settlements.push({
          id: `settlement-${keyId++}`,
          fromPlayerName: debtor.name,
          toPlayerName: creditor.name,
          amount: amountToTransfer,
        });

        debtor.amount = roundTo(debtor.amount - amountToTransfer, 2);
        creditor.amount = roundTo(creditor.amount - amountToTransfer, 2);
      }


      if (debtor.amount < 0.005) { // Adjusted threshold
        debtors.shift();
      }
      if (creditor.amount < 0.005) { // Adjusted threshold
        creditors.shift();
      }
    }
    
    const totalValueFromEnteredChips = roundTo(currentTotalChipsInPlay * FIXED_CHIP_VALUE_INR, 2);
    const expectedTotalChips = FIXED_CHIP_VALUE_INR > 0 ? roundTo(totalPot / FIXED_CHIP_VALUE_INR, 0) : 0;
    const chipDiscrepancy = roundTo(currentTotalChipsInPlay - expectedTotalChips, 0);


    return {
      totalChipsInPlay: currentTotalChipsInPlay,
      chipValue: FIXED_CHIP_VALUE_INR,
      calculatedPlayers: playersWithCalculations,
      settlements,
      chipDiscrepancy,
      expectedTotalChips,
      totalValueFromEnteredChips
    };
  }, [editablePlayers, totalPot]);

  const getDiscrepancyMessage = () => {
    const { chipDiscrepancy, totalChipsInPlay, expectedTotalChips } = derivedPayoutData;

    if (totalPot === 0 && totalChipsInPlay === 0 && editablePlayers.length > 0) {
      return <p className="text-xs text-muted-foreground">Enter final chip counts. Total pot is ₹0.00 (Expected chips: 0).</p>;
    }
    if (editablePlayers.length === 0){
        return <p className="text-xs text-muted-foreground">Add players to start.</p>;
    }
    
    const formattedChipDiscrepancy = Math.abs(chipDiscrepancy).toLocaleString('en-IN');

    if (chipDiscrepancy === 0 && totalPot > 0) {
      return (
        <div className="flex items-center text-xs text-green-500">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          <span>Entered chips ({totalChipsInPlay.toLocaleString('en-IN')}) match expected ({expectedTotalChips.toLocaleString('en-IN')}) from pot. Balanced.</span>
        </div>
      );
    } else if (chipDiscrepancy > 0) {
      return (
        <div className="flex items-center text-xs text-orange-500">
          <AlertTriangle className="h-3 w-3 mr-1" />
          <span>Chip Surplus: +{formattedChipDiscrepancy} chips. (Entered: {totalChipsInPlay.toLocaleString('en-IN')}, Expected: {expectedTotalChips.toLocaleString('en-IN')}). Review entries.</span>
        </div>
      );
    } else if (chipDiscrepancy < 0) {
      return (
        <div className="flex items-center text-xs text-destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          <span>Chip Shortage: {formattedChipDiscrepancy} chips. (Entered: {totalChipsInPlay.toLocaleString('en-IN')}, Expected: {expectedTotalChips.toLocaleString('en-IN')}). Review entries.</span>
        </div>
      );
    }
    return <p className="text-xs text-muted-foreground">Enter final chip counts to see reconciliation. Expected chips from pot: {expectedTotalChips.toLocaleString('en-IN')}.</p>;
  };
  
  const getChipInputValue = (player: PayoutPlayer) => {
    if (player.finalChips === 0 && activeInputPlayerId !== player.id) {
        return '';
    }
    return player.finalChips.toString();
  };

  const handleBlurFinalChips = (playerId: string) => {
    setActiveInputPlayerId(null);
    const playerChipData = editablePlayers.find(p => p.id === playerId);
    // It's generally better to rely on React state than direct DOM manipulation for values.
    // The `handleFinalChipChange` already updates the state.
    // This logic ensures that if a field is blurred while empty or invalid, it's set to 0.
    if (playerChipData) {
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
        <CardDescription>Enter final chip counts to calculate net results and who pays whom to settle. Chip value is fixed at ₹{FIXED_CHIP_VALUE_INR.toFixed(2)}.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-4 border rounded-lg bg-card/50 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Pot Value (Invested):</span>
            <span className="font-semibold text-lg text-accent">
              {totalPot.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Expected Total Chips (from Pot @ ₹{FIXED_CHIP_VALUE_INR.toFixed(2)}/chip):</span>
            <span className="font-semibold text-lg">
              {derivedPayoutData.expectedTotalChips.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Actual Chips (from inputs):</span>
            <span className="font-semibold text-lg">
              {derivedPayoutData.totalChipsInPlay.toLocaleString('en-IN')}
            </span>
          </div>
           <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Value from Actual Chips (at ₹{FIXED_CHIP_VALUE_INR.toFixed(2)}/chip):</span>
            <span className="font-semibold text-lg">
              {derivedPayoutData.totalValueFromEnteredChips.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-1 min-h-[16px]">
            {getDiscrepancyMessage()}
          </div>
          <div className="flex justify-between items-center mt-2">
              <span className="text-muted-foreground">Fixed Value Per Chip:</span>
              <span className="font-semibold text-sm">
                {FIXED_CHIP_VALUE_INR.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
        </div>

        {contextPlayers.length === 0 ? ( 
          <p className="text-muted-foreground text-center py-4">Add players in 'Player Management' to calculate payouts.</p>
        ) : (
          <>
            <h3 className="text-lg font-semibold mb-2">Player Net Results</h3>
            <p className="text-xs text-muted-foreground mb-3">
              * Edit final chip counts below. These edits do not affect the main game log.
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
                          type="text" 
                          value={getChipInputValue(player)}
                          onFocus={() => setActiveInputPlayerId(player.id)}
                          onBlur={() => handleBlurFinalChips(player.id)}
                          onChange={(e) => handleFinalChipChange(player.id, e)}
                          id={`finalChips-${player.id}`}
                          className="h-8 text-right w-full"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell py-2">{player.totalInvested.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right hidden md:table-cell py-2">{player.finalValue.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className={`text-right font-semibold py-2 ${player.netAmount >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                        {player.netAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                        <TableHead className="text-right">Amount (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {derivedPayoutData.settlements.map((payment) => (
                        <TableRow key={payment.id} className="table-row-hover">
                          <TableCell className="py-2">{payment.fromPlayerName}</TableCell>
                          <TableCell className="py-2">{payment.toPlayerName}</TableCell>
                          <TableCell className="text-right font-medium py-2">
                            {payment.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            )}
             {derivedPayoutData.settlements.length === 0 && editablePlayers.length > 0 && derivedPayoutData.totalChipsInPlay > 0 && totalPot > 0 && derivedPayoutData.chipDiscrepancy === 0 && (
              <p className="text-muted-foreground text-center py-4">All players broke even or no payments needed.</p>
            )}
             {editablePlayers.length > 0 && derivedPayoutData.totalChipsInPlay > 0 && totalPot === 0 && (
                <p className="text-muted-foreground text-center py-4">Total pot is ₹0.00. Cannot calculate meaningful payouts against investment.</p>
             )}
             {editablePlayers.length > 0 && derivedPayoutData.totalChipsInPlay === 0 && totalPot > 0 && (
                <p className="text-muted-foreground text-center py-4">Enter final chip counts. Total actual chips currently zero.</p>
             )}
          </>
        )}
        <div className="mt-6 text-xs text-muted-foreground space-y-1">
          <p>* Final Chips = Manually entered chip count for each player at game end.</p>
          <p>* Final Value (₹) = Player's Final Chips * ₹{FIXED_CHIP_VALUE_INR.toFixed(2)}.</p>
          <p>* Net (₹) = Final Value (₹) - Total Invested (₹).</p>
          <p>* Settlement Transactions show the payments needed to reconcile all player net amounts.</p>
          <p>* Chip Discrepancy compares total actual chips entered to the expected total chips (calculated from Total Pot Value at the fixed chip rate).</p>
        </div>
      </CardContent>
    </Card>
  );
}

