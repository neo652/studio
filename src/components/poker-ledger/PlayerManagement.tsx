
"use client";

import { useState } from "react";
import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit3, Trash2, Repeat, MinusCircle, UsersRound } from "lucide-react";
import { PlayerFormDialog } from "./PlayerFormDialog";
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
// ScrollArea import is removed as it's no longer used here

export function PlayerManagement() {
  const { players, addPlayer, editPlayerName, removePlayer, performTransaction } = usePokerLedger();
  const [isAddPlayerDialogOpen, setIsAddPlayerDialogOpen] = useState(false);
  const [isEditPlayerDialogOpen, setIsEditPlayerDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [transactionType, setTransactionType] = useState<'rebuy' | 'cut' | null>(null);

  const handleAddPlayerSubmit = (data: { name: string; initialBuyIn?: number }) => {
    if (data.name && data.initialBuyIn) {
      addPlayer(data.name, data.initialBuyIn);
    }
  };

  const handleEditPlayerSubmit = (data: { name: string }) => {
    if (selectedPlayer && data.name) {
      editPlayerName(selectedPlayer.id, data.name);
    }
  };

  const handleTransactionSubmit = (amount: number) => {
    if (selectedPlayer && transactionType) {
      performTransaction(selectedPlayer.id, transactionType, amount);
    }
  };

  const openEditDialog = (player: Player) => {
    setSelectedPlayer(player);
    setIsEditPlayerDialogOpen(true);
  };

  const openTransactionDialog = (player: Player, type: 'rebuy' | 'cut') => {
    setSelectedPlayer(player);
    setTransactionType(type);
    setIsTransactionDialogOpen(true);
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <UsersRound className="h-6 w-6 text-primary" />
          <CardTitle>Player Management</CardTitle>
        </div>
        <Button onClick={() => setIsAddPlayerDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Player
        </Button>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No players added yet. Click "Add Player" to start.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Chips</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Invested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => (
                <TableRow key={player.id} className="table-row-hover">
                  <TableCell className="font-medium">{player.name}</TableCell>
                  <TableCell className="text-right">{player.chips.toLocaleString()}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{player.totalInvested.toLocaleString()}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openTransactionDialog(player, 'rebuy')} title="Rebuy">
                      <Repeat className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openTransactionDialog(player, 'cut')} title="Cut Chips">
                      <MinusCircle className="h-4 w-4 text-orange-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(player)} title="Edit Name">
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
        isOpen={isAddPlayerDialogOpen}
        onClose={() => setIsAddPlayerDialogOpen(false)}
        onSubmit={handleAddPlayerSubmit}
        mode="add"
      />
      {selectedPlayer && (
        <>
          <PlayerFormDialog
            isOpen={isEditPlayerDialogOpen}
            onClose={() => setIsEditPlayerDialogOpen(false)}
            onSubmit={handleEditPlayerSubmit}
            defaultValues={selectedPlayer}
            mode="editName"
          />
          <TransactionDialog
            isOpen={isTransactionDialogOpen && transactionType !== null}
            onClose={() => setIsTransactionDialogOpen(false)}
            onSubmit={handleTransactionSubmit}
            playerName={selectedPlayer.name}
            transactionType={transactionType!} 
          />
        </>
      )}
    </Card>
  );
}
