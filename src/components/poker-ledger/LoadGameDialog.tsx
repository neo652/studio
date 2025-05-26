
"use client";

import * as React from "react";
import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import type { SavedGameSummary } from "@/types/poker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface LoadGameDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoadGameDialog({ isOpen, onClose }: LoadGameDialogProps) {
  const { fetchSavedGames, fetchRecentSavedGamesForLoadDialog, loadGameData, isSyncing: isContextSyncing } = usePokerLedger();
  const [savedGames, setSavedGames] = React.useState<SavedGameSummary[]>([]);
  const [selectedGameId, setSelectedGameId] = React.useState<string | undefined>(undefined);
  const [isLoadingGames, setIsLoadingGames] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const loadGames = async () => {
        setIsLoadingGames(true);
        setSelectedGameId(undefined); // Reset selection
        
        let games: SavedGameSummary[] = [];
        if (typeof window !== 'undefined') {
          const hostname = window.location.hostname;
          const isDevelopmentEnvironment =
            hostname === 'localhost' ||
            hostname.endsWith('.cloudworkstations.dev'); // Add other Firebase Studio specific patterns if needed

          if (process.env.NODE_ENV === 'development') {
            console.log(`LoadGameDialog: Hostname: ${hostname}, isDevelopmentEnvironment: ${isDevelopmentEnvironment}`);
          }

          if (isDevelopmentEnvironment) {
            games = await fetchSavedGames();
             if (process.env.NODE_ENV === 'development') {
                console.log('LoadGameDialog: Fetched all games for dialog (dev environment):', JSON.parse(JSON.stringify(games)));
            }
          } else {
            games = await fetchRecentSavedGamesForLoadDialog();
             if (process.env.NODE_ENV === 'development') {
                console.log('LoadGameDialog: Fetched recent 2 games for dialog (prod environment):', JSON.parse(JSON.stringify(games)));
            }
          }
        } else {
          // Fallback for SSR or environments where window is not defined, though this component is client-side.
          games = await fetchRecentSavedGamesForLoadDialog();
           if (process.env.NODE_ENV === 'development') {
            console.log('LoadGameDialog: Fetched recent 2 games for dialog (window undefined fallback):', JSON.parse(JSON.stringify(games)));
          }
        }
        
        setSavedGames(games);
        setIsLoadingGames(false);
      };
      loadGames();
    }
  }, [isOpen, fetchSavedGames, fetchRecentSavedGamesForLoadDialog]);

  const handleLoadSelectedGame = async () => {
    if (selectedGameId) {
      const success = await loadGameData(selectedGameId);
      if (success) {
        onClose(); // Close dialog on successful load
      }
    }
  };

  const isOverallSyncing = isLoadingGames || isContextSyncing;

  return (
    <Dialog open={isOpen} onOpenChange={(openState) => { if (!openState) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Load Game from Cloud</DialogTitle>
          <DialogDescription>
            Select a game to load into your current session. This will overwrite any unsaved local data.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {isLoadingGames && ( 
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading saved games...</p>
            </div>
          )}
          {!isLoadingGames && savedGames.length === 0 && (
            <p className="text-center text-muted-foreground">No saved games found in the cloud.</p>
          )}
          {!isLoadingGames && savedGames.length > 0 && (
            <Select
              onValueChange={setSelectedGameId}
              value={selectedGameId}
              disabled={isOverallSyncing} 
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a game to load..." />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="h-[200px]">
                  {savedGames.map((game) => (
                    <SelectItem key={game.id} value={game.id}>
                      {`Game saved: ${game.savedAt} (${game.playerCount} players, Pot: ₹${game.totalPot.toLocaleString()})`}
                    </SelectItem>
                  ))}
                </ScrollArea>
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isOverallSyncing}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleLoadSelectedGame}
            disabled={!selectedGameId || isOverallSyncing}
          >
            {isContextSyncing && selectedGameId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Load Selected Game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
