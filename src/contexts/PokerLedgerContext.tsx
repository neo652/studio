
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Player, Transaction, PokerState, PokerContextType, TransactionType, FirestoreGameData } from '@/types/poker';
import { useToast } from '@/hooks/use-toast';
import { getDb } from '@/lib/firebase'; // Import getDb
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const POKER_LEDGER_STORAGE_KEY = 'pokerLedgerState';
const FIRESTORE_GAME_DOC_PATH = "pokerGames/defaultGame"; // Path for the single game document

const PokerLedgerContext = createContext<PokerContextType | undefined>(undefined);

const generateId = () => crypto.randomUUID();

export const PokerLedgerProvider = ({ children }: { children: ReactNode }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalPot, setTotalPot] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
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
      toast({ title: "Error", description: "Could not load saved game data from local storage.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!isLoading) { // Only save to localStorage if not in initial loading phase
      try {
        const stateToStore: PokerState = { players, transactions, totalPot };
        localStorage.setItem(POKER_LEDGER_STORAGE_KEY, JSON.stringify(stateToStore));
      } catch (error) {
        console.error("Failed to save state to localStorage", error);
        // Avoid toasting too frequently for localStorage errors if they are persistent
        // toast({ title: "Error", description: "Could not save game progress to local storage.", variant: "destructive" });
      }
    }
  }, [players, transactions, totalPot, isLoading]);

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
        return prevPlayers;
      }

      const newPlayer: Player = {
        id: generateId(),
        name,
        chips: initialBuyIn,
        totalInvested: initialBuyIn,
      };
      const newPlayersArray = [...prevPlayers, newPlayer];
      addTransaction(newPlayer.id, newPlayer.name, 'buy-in', initialBuyIn, newPlayer.chips);
      updateTotalPot(newPlayersArray);
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
      if (!playerToRemove) return prevPlayers;
      const updatedPlayers = prevPlayers.filter(p => p.id !== playerId);
      toast({ title: "Player Removed", description: `${playerToRemove.name} has been removed.` });
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

      const updatedPlayers = [...prevPlayers];
      const player = { ...updatedPlayers[playerIndex] };

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
        if (player.totalInvested < 0) player.totalInvested = 0;
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
    // localStorage.removeItem(POKER_LEDGER_STORAGE_KEY); // This will be cleared by the useEffect when states are empty
    toast({ title: "New Game Started", description: "All previous game data has been cleared." });
  }, [toast]);

  const saveGameToFirestore = async () => {
    const db = getDb();
    if (!db) {
      toast({ title: "Sync Error", description: "Firestore is not initialized. Check Firebase config.", variant: "destructive" });
      return;
    }
    setIsSyncing(true);
    try {
      const gameData: FirestoreGameData = {
        players,
        transactions,
        totalPot,
        syncedAt: serverTimestamp(),
      };
      await setDoc(doc(db, FIRESTORE_GAME_DOC_PATH), gameData);
      toast({ title: "Sync Success", description: "Game data saved to Cloud." });
    } catch (error) {
      console.error("Error saving to Firestore:", error);
      toast({ title: "Sync Error", description: "Failed to save game data to Cloud.", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const loadGameFromFirestore = async () => {
    const db = getDb();
    if (!db) {
      toast({ title: "Sync Error", description: "Firestore is not initialized. Check Firebase config.", variant: "destructive" });
      return;
    }
    setIsSyncing(true);
    try {
      const docRef = doc(db, FIRESTORE_GAME_DOC_PATH);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const gameData = docSnap.data() as Omit<FirestoreGameData, 'syncedAt'>; // syncedAt handled by server
        setPlayers(gameData.players || []);
        setTransactions(gameData.transactions || []);
        setTotalPot(gameData.totalPot || 0);
        // localStorage will be updated by the useEffect watching these state variables
        toast({ title: "Sync Success", description: "Game data loaded from Cloud." });
      } else {
        toast({ title: "Sync Info", description: "No game data found in Cloud to load.", variant: "default" });
      }
    } catch (error) {
      console.error("Error loading from Firestore:", error);
      toast({ title: "Sync Error", description: "Failed to load game data from Cloud.", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <PokerLedgerContext.Provider value={{ 
      players, transactions, totalPot, addPlayer, editPlayerName, removePlayer, performTransaction, 
      adjustPayout, resetGame, isLoading, isSyncing, saveGameToFirestore, loadGameFromFirestore 
    }}>
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
