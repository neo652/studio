
"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RefreshCw, VenetianMask, CloudUpload, CloudDownload, Loader2, LayoutDashboard, Info, Home } from "lucide-react";
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
import { LoadGameDialog } from "./LoadGameDialog"; 

interface HeaderProps {
  pageType?: 'main' | 'dashboard';
}

export function Header({ pageType = 'main' }: HeaderProps) {
  const { 
    resetGame, 
    saveGameToFirestore, 
    isSyncing, 
    players,
    currentFirestoreGameId,
    currentGameSavedAt 
  } = usePokerLedger();
  const [isLoadGameDialogOpen, setIsLoadGameDialogOpen] = React.useState(false);

  const handleSaveGame = async () => {
    await saveGameToFirestore(); 
  };

  const formatGameTimestamp = (isoString: string | null): string => {
    if (!isoString) return "New Game";
    try {
      return new Date(isoString).toLocaleString();
    } catch (e) {
      return "Invalid Date";
    }
  };

  const gameStatusText = currentFirestoreGameId 
    ? `Game Loaded: ${formatGameTimestamp(currentGameSavedAt)} (ID: ${currentFirestoreGameId.substring(0,6)}...)`
    : "Current Session: New Game";

  return (
    <>
      <header className="flex flex-col sm:flex-row justify-between items-center pb-6 border-b-2 border-primary">
        <div className="flex items-center space-x-3 mb-4 sm:mb-0">
          <VenetianMask className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
          <h1 className="text-2xl sm:text-4xl font-bold text-primary">
            {pageType === 'dashboard' ? 'Poker Ledger Dashboard' : 'Poker Ledger'}
          </h1>
        </div>
        <div className="flex flex-col items-center sm:items-end space-y-2 sm:space-y-0">
            {pageType === 'main' && (
              <>
                <div className="text-xs text-muted-foreground mb-1 flex items-center">
                    <Info size={14} className="mr-1 text-primary"/> {gameStatusText}
                </div>
                <div className="flex items-center space-x-2 flex-wrap justify-center sm:justify-end gap-y-2">
                  <Link href="/dashboard" passHref prefetch={false}>
                      <Button variant="outline" title="View Dashboard" disabled={isSyncing}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                      </Button>
                  </Link>
                  <Button 
                      variant="outline" 
                      onClick={() => setIsLoadGameDialogOpen(true)} 
                      disabled={isSyncing}
                      title="Load game data from Cloud"
                  >
                      {isSyncing && isLoadGameDialogOpen ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudDownload className="mr-2 h-4 w-4" />}
                      Load
                  </Button>
                  <Button 
                      variant="outline" 
                      onClick={handleSaveGame} 
                      disabled={isSyncing || players.length === 0}
                      title={players.length === 0 ? "Add players to enable save" : (currentFirestoreGameId ? "Update current game in Cloud" : "Save current game to Cloud")}
                  >
                      {isSyncing && !isLoadGameDialogOpen ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudUpload className="mr-2 h-4 w-4" />}
                      {currentFirestoreGameId ? 'Update' : 'Save'}
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
                          This will clear all current game data (players, transactions, etc.) in your browser and start a fresh session. This action cannot be undone for local data.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={resetGame}>Start New Game</AlertDialogAction>
                      </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
            {pageType === 'dashboard' && (
              <Link href="/" passHref>
                <Button variant="outline" title="Return to Game">
                  <Home className="mr-2 h-4 w-4" />
                  Return to Game
                </Button>
              </Link>
            )}
        </div>
      </header>
      {pageType === 'main' && (
        <LoadGameDialog
          isOpen={isLoadGameDialogOpen}
          onClose={() => setIsLoadGameDialogOpen(false)}
        />
      )}
    </>
  );
}
