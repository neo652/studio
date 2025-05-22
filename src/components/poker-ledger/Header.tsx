
"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, VenetianMask, CloudUpload, CloudDownload, Loader2 } from "lucide-react";
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
  const { resetGame, saveGameToFirestore, loadGameFromFirestore, isSyncing } = usePokerLedger();

  return (
    <header className="flex flex-col sm:flex-row justify-between items-center pb-6 border-b-2 border-primary">
      <div className="flex items-center space-x-3 mb-4 sm:mb-0">
        <VenetianMask className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold text-primary">Poker Ledger</h1>
      </div>
      <div className="flex items-center space-x-2">
        <Button 
          variant="outline" 
          onClick={loadGameFromFirestore} 
          disabled={isSyncing}
          title="Load game data from Cloud"
        >
          {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudDownload className="mr-2 h-4 w-4" />}
          Load
        </Button>
        <Button 
          variant="outline" 
          onClick={saveGameToFirestore} 
          disabled={isSyncing}
          title="Save current game data to Cloud"
        >
          {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudUpload className="mr-2 h-4 w-4" />}
          Save
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isSyncing} title="Start a new game">
              <RefreshCw className="mr-2 h-4 w-4" /> New Game
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear all current game data (players, transactions, etc.) in your browser and start a fresh game. This action cannot be undone for local data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={resetGame}>Start New Game</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </header>
  );
}
