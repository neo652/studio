
"use client";

import { useState } from "react";
import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit3, Trash2, Repeat, MinusCircle, UsersRound } from "lucide-react";
import { PlayerFormDialog, type PlayerFormDialogSubmitData } from "./PlayerFormDialog";
import { TransactionDialog } from "./TransactionDialog";
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
import type { Player } from "@/types/poker";
import { useToast } from "@/hooks/use-toast";


export function PlayerManagement() {
  const { players, addPlayer, editPlayerName, removePlayer, performTransaction } = usePokerLedger();
  const { toast } = useToast();

  const [isPlayerFormOpen, setIsPlayerFormOpen] = useState(false);
  const [playerFormMode, setPlayerFormMode] = useState<'add' | 'editName'>('add');
  
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [transactionType, setTransactionType] = useState<'rebuy' | 'cut' | null>(null);

  const handlePlayerFormSubmit = (data: PlayerFormDialogSubmitData) => {
    if (playerFormMode === 'add') {
      let playersAddedCount = 0;
      if (data.defaultPlayersToAdd && data.initialBuyIn) {
        data.defaultPlayersToAdd.forEach(name => {
          // addPlayer already checks for duplicates and toasts, so we rely on that
          addPlayer(name, data.initialBuyIn!);
          playersAddedCount++;
        });
      }
      if (data.customPlayerName && data.initialBuyIn) {
         // addPlayer already checks for duplicates and toasts
        addPlayer(data.customPlayerName, data.initialBuyIn);
        playersAddedCount++;
      }
      if (playersAddedCount > 0) {
        // Toast for overall success, individual errors handled by addPlayer
        // toast({ title: "Players Processed", description: `Attempted to add ${playersAddedCount} player(s).`});
      }
    } else if (playerFormMode === 'editName' && selectedPlayer && data.editedName) {
      if (players.some(p => p.name.toLowerCase() === data.editedName!.toLowerCase() && p.id !== selectedPlayer.id)) {
        toast({
          title: "Error",
          description: `Player name "${data.editedName}" is already in use.`,
          variant: "destructive",
        });
        return; // Keep dialog open
      }
      editPlayerName(selectedPlayer.id, data.editedName);
    }
    setIsPlayerFormOpen(false); // Close dialog on successful submission or if no players were added
  };

  const handleTransactionSubmit = (amount: number) => {
    if (selectedPlayer && transactionType) {
      performTransaction(selectedPlayer.id, transactionType, amount);
    }
    setIsTransactionDialogOpen(false);
  };

  const openAddPlayerDialog = () => {
    setPlayerFormMode('add');
    setSelectedPlayer(null); // Clear selected player for add mode
    setIsPlayerFormOpen(true);
  };

  const openEditNameDialog = (player: Player) => {
    setPlayerFormMode('editName');
    setSelectedPlayer(player);
    setIsPlayerFormOpen(true);
  };

  const openTransactionDialog = (player: Player, type: 'rebuy' | 'cut') => {
    setSelectedPlayer(player);
    setTransactionType(type);
    setIsTransactionDialogOpen(true);
  };
  
  const existingPlayerNamesLowerCase = players.map(p => p.name.toLowerCase());

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <UsersRound className="h-6 w-6 text-primary" />
          <CardTitle>Player Management</CardTitle>
        </div>
        <Button onClick={openAddPlayerDialog}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Players
        </Button>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No players added yet. Click "Add Players" to start.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-2 sm:px-4">Name</TableHead>
                <TableHead className="text-right px-2 sm:px-4">Chips</TableHead>
                <TableHead className="text-right hidden sm:table-cell px-2 sm:px-4">Invested</TableHead>
                <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => (
                <TableRow key={player.id} className="table-row-hover">
                  <TableCell className="font-medium py-2 px-2 sm:px-4">{player.name}</TableCell>
                  <TableCell className="text-right py-2 px-2 sm:px-4">{player.chips.toLocaleString()}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell py-2 px-2 sm:px-4">{player.totalInvested.toLocaleString()}</TableCell>
                  <TableCell className="text-right space-x-0 sm:space-x-1 py-2 px-2 sm:px-4">
                    <Button variant="ghost" size="icon" onClick={() => openTransactionDialog(player, 'rebuy')} title="Rebuy">
                      <Repeat className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openTransactionDialog(player, 'cut')} title="Cut Chips">
                      <MinusCircle className="h-4 w-4 text-orange-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditNameDialog(player)} title="Edit Name">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                     <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Remove Player">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {player.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {player.name}? Their invested chips will remain in the pot for payout calculations. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removePlayer(player.id)}>Remove Player</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <PlayerFormDialog
        isOpen={isPlayerFormOpen}
        onClose={() => setIsPlayerFormOpen(false)}
        onSubmit={handlePlayerFormSubmit}
        mode={playerFormMode}
        defaultValuesForEdit={selectedPlayer || undefined}
        existingPlayerNamesWhileAdding={existingPlayerNamesLowerCase}
      />
      
      {selectedPlayer && transactionType && ( // Ensure both are set for TransactionDialog
          <TransactionDialog
            isOpen={isTransactionDialogOpen}
            onClose={() => setIsTransactionDialogOpen(false)}
            onSubmit={handleTransactionSubmit}
            playerName={selectedPlayer.name}
            transactionType={transactionType} 
          />
      )}
    </Card>
  );
}
