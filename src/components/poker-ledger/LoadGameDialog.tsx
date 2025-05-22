
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
  const { fetchSavedGames, loadGameData, isSyncing: isContextSyncing } = usePokerLedger();
  const [savedGames, setSavedGames] = React.useState<SavedGameSummary[]>([]);
  const [selectedGameId, setSelectedGameId] = React.useState<string | undefined>(undefined);
  const [isLoadingGames, setIsLoadingGames] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const loadGames = async () => {
        setIsLoadingGames(true);
        setSelectedGameId(undefined); // Reset selection
        const games = await fetchSavedGames();
        setSavedGames(games);
        setIsLoadingGames(false);
      };
      loadGames();
    }
  }, [isOpen, fetchSavedGames]);

  const handleLoadSelectedGame = async () => {
    if (selectedGameId) {
      const success = await loadGameData(selectedGameId);
      if (success) {
        onClose(); // Close dialog on successful load
      }
    }
  };

  const isSyncing = isLoadingGames || isContextSyncing;

  return (
    <Dialog open={isOpen} onOpenChange={(openState) => { if (!openState) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Load Game from Cloud</DialogTitle>
          <DialogDescription>
            Select a previously saved game to load into your current session. This will overwrite any unsaved local data.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {isSyncing && savedGames.length === 0 && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading saved games...</p>
            </div>
          )}
          {!isSyncing && savedGames.length === 0 && (
            <p className="text-center text-muted-foreground">No saved games found in the cloud.</p>
          )}
          {savedGames.length > 0 && (
            <Select
              onValueChange={setSelectedGameId}
              value={selectedGameId}
              disabled={isSyncing}
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
          <Button type="button" variant="outline" onClick={onClose} disabled={isSyncing}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleLoadSelectedGame}
            disabled={!selectedGameId || isSyncing}
          >
            {isSyncing && selectedGameId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Load Selected Game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
