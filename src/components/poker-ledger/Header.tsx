
"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, VenetianMask } from "lucide-react";
import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function Header() {
  const { resetGame } = usePokerLedger();

  return (
    <header className="flex flex-col sm:flex-row justify-between items-center pb-6 border-b-2 border-primary">
      <div className="flex items-center space-x-3 mb-4 sm:mb-0">
        <VenetianMask className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold text-primary">Poker Ledger</h1>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">
            <RefreshCw className="mr-2 h-4 w-4" /> New Game
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all current game data (players, transactions, etc.) and start a fresh game. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={resetGame}>Start New Game</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
