
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Player, Transaction, PokerState, PokerContextType, TransactionType } from '@/types/poker';
import { useToast } from '@/hooks/use-toast';

const POKER_LEDGER_STORAGE_KEY = 'pokerLedgerState';

const PokerLedgerContext = createContext<PokerContextType | undefined>(undefined);

const generateId = () => crypto.randomUUID();

export const PokerLedgerProvider = ({ children }: { children: ReactNode }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalPot, setTotalPot] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedState = localStorage.getItem(POKER_LEDGER_STORAGE_KEY);
      if (storedState) {
        const parsedState: PokerState = JSON.parse(storedState);
        setPlayers(parsedState.players || []);
        setTransactions(parsedState.transactions || []);
        setTotalPot(parsedState.totalPot || 0);
      }
    } catch (error) {
      console.error("Failed to load state from localStorage", error);
      toast({ title: "Error", description: "Could not load saved game data.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!isLoading) {
      try {
        const stateToStore: PokerState = { players, transactions, totalPot };
        localStorage.setItem(POKER_LEDGER_STORAGE_KEY, JSON.stringify(stateToStore));
      } catch (error) {
        console.error("Failed to save state to localStorage", error);
        toast({ title: "Error", description: "Could not save game progress.", variant: "destructive" });
      }
    }
  }, [players, transactions, totalPot, isLoading, toast]);

  const updateTotalPot = useCallback((updatedPlayersList: Player[]) => {
    const newTotalPot = updatedPlayersList.reduce((sum, player) => sum + player.totalInvested, 0);
    setTotalPot(newTotalPot);
  }, []);

  const addTransaction = useCallback((playerId: string, playerName: string, type: TransactionType, amount: number, balanceAfter: number) => {
    const newTransaction: Transaction = {
      id: generateId(),
      playerId,
      playerName,
      type,
      amount,
      balanceAfter,
      timestamp: new Date().toISOString(),
    };
    setTransactions(prev => [newTransaction, ...prev]);
  }, []);

  const addPlayer = useCallback((name: string, initialBuyIn: number) => {
    if (!name.trim()) {
      toast({ title: "Error", description: "Player name cannot be empty.", variant: "destructive" });
      return;
    }
    if (initialBuyIn <= 0) {
      toast({ title: "Error", description: "Initial buy-in must be positive.", variant: "destructive" });
      return;
    }

    setPlayers(prevPlayers => {
      if (prevPlayers.find(p => p.name.toLowerCase() === name.toLowerCase())) {
        toast({ title: "Error", description: `Player "${name}" already exists.`, variant: "destructive" });
        return prevPlayers; // Return previous state if duplicate
      }

      const newPlayer: Player = {
        id: generateId(),
        name,
        chips: initialBuyIn,
        totalInvested: initialBuyIn,
      };
      const newPlayersArray = [...prevPlayers, newPlayer];
      addTransaction(newPlayer.id, newPlayer.name, 'buy-in', initialBuyIn, newPlayer.chips);
      updateTotalPot(newPlayersArray); // Ensure this gets the latest array
      toast({ title: "Player Added", description: `${name} joined with ${initialBuyIn} chips.` });
      return newPlayersArray;
    });
  }, [addTransaction, updateTotalPot, toast]);

  const editPlayerName = useCallback((playerId: string, newName: string) => {
    if (!newName.trim()) {
      toast({ title: "Error", description: "Player name cannot be empty.", variant: "destructive" });
      return;
    }
    setPlayers(prevPlayers =>
      prevPlayers.map(p => (p.id === playerId ? { ...p, name: newName } : p))
    );
    setTransactions(prevTransactions => 
      prevTransactions.map(t => (t.playerId === playerId ? { ...t, playerName: newName } : t))
    );
    toast({ title: "Player Updated", description: `Player name changed to ${newName}.` });
  }, [toast]);

  const removePlayer = useCallback((playerId: string) => {
    setPlayers(prevPlayers => {
      const playerToRemove = prevPlayers.find(p => p.id === playerId);
      if (!playerToRemove) {
        return prevPlayers;
      }
      const updatedPlayers = prevPlayers.filter(p => p.id !== playerId);
      // Total pot remains unchanged as their investment is still part of the game's total.
      toast({ title: "Player Removed", description: `${playerToRemove.name} has been removed from the game.` });
      return updatedPlayers;
    });
  }, [toast]);

  const performTransaction = useCallback((playerId: string, type: 'rebuy' | 'cut', amount: number) => {
    if (amount <= 0) {
      toast({ title: "Error", description: "Transaction amount must be positive.", variant: "destructive" });
      return;
    }
    
    setPlayers(prevPlayers => {
      const playerIndex = prevPlayers.findIndex(p => p.id === playerId);
      if (playerIndex === -1) {
        toast({ title: "Error", description: "Player not found.", variant: "destructive" });
        return prevPlayers;
      }

      const updatedPlayers = [...prevPlayers]; // Create a mutable copy of the previous players array
      const player = { ...updatedPlayers[playerIndex] }; // Create a mutable copy of the player object

      if (type === 'rebuy') {
        player.chips += amount;
        player.totalInvested += amount;
      } else if (type === 'cut') {
        if (player.chips < amount) {
          toast({ title: "Error", description: "Cannot cut more chips than player has.", variant: "destructive" });
          return prevPlayers;
        }
        player.chips -= amount;
        player.totalInvested -= amount; 
        if (player.totalInvested < 0) { 
          player.totalInvested = 0;
        }
      }
      
      updatedPlayers[playerIndex] = player;
      addTransaction(player.id, player.name, type, amount, player.chips);
      updateTotalPot(updatedPlayers);
      toast({ title: "Transaction Complete", description: `${player.name}'s chips updated by ${type === 'rebuy' ? '+' : '-'}${amount}.` });
      return updatedPlayers;
    });
  }, [addTransaction, updateTotalPot, toast]);

  const adjustPayout = useCallback((playerId: string, adjustmentAmount: number) => {
    setPlayers(prevPlayers => {
      const playerIndex = prevPlayers.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return prevPlayers;

      const updatedPlayers = [...prevPlayers];
      const player = { ...updatedPlayers[playerIndex] };
      player.chips += adjustmentAmount;

      if (player.chips < 0) {
         toast({ title: "Warning", description: `${player.name}'s chips went below zero after adjustment.`, variant: "destructive" });
      }

      updatedPlayers[playerIndex] = player;
      addTransaction(player.id, player.name, 'payout_adjustment', Math.abs(adjustmentAmount), player.chips);
      toast({ title: "Payout Adjusted", description: `${player.name}'s payout balance adjusted by ${adjustmentAmount}.` });
      return updatedPlayers;
    });
  }, [addTransaction, toast]);

  const resetGame = useCallback(() => {
    setPlayers([]);
    setTransactions([]);
    setTotalPot(0);
    localStorage.removeItem(POKER_LEDGER_STORAGE_KEY);
    toast({ title: "New Game Started", description: "All previous game data has been cleared." });
  }, [toast]);

  return (
    <PokerLedgerContext.Provider value={{ players, transactions, totalPot, addPlayer, editPlayerName, removePlayer, performTransaction, adjustPayout, resetGame, isLoading }}>
      {children}
    </PokerLedgerContext.Provider>
  );
};

export const usePokerLedger = (): PokerContextType => {
  const context = useContext(PokerLedgerContext);
  if (context === undefined) {
    throw new Error('usePokerLedger must be used within a PokerLedgerProvider');
  }
  return context;
};

