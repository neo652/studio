
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Player, Transaction, PokerState, PokerContextType, FirestoreGameData, SavedGameSummary } from '@/types/poker';
import { useToast } from '@/hooks/use-toast';
import { getDb } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp, collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';

const POKER_LEDGER_STORAGE_KEY = 'pokerLedgerState';
const FIRESTORE_GAMES_COLLECTION_PATH = "pokerGames";

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
    if (!isLoading) {
      try {
        const stateToStore: PokerState = { players, transactions, totalPot };
        localStorage.setItem(POKER_LEDGER_STORAGE_KEY, JSON.stringify(stateToStore));
      } catch (error) {
        console.error("Failed to save state to localStorage", error);
      }
    }
  }, [players, transactions, totalPot, isLoading]);

  const updateTotalPot = useCallback((updatedPlayersList: Player[]) => {
    const newTotalPot = updatedPlayersList.reduce((sum, player) => sum + player.totalInvested, 0);
    setTotalPot(newTotalPot);
  }, []);

  const addTransactionEntry = useCallback((playerId: string, playerName: string, type: TransactionType, amount: number, balanceAfter: number) => {
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
      const newPlayer: Player = { id: generateId(), name, chips: initialBuyIn, totalInvested: initialBuyIn };
      const newPlayersArray = [...prevPlayers, newPlayer];
      addTransactionEntry(newPlayer.id, newPlayer.name, 'buy-in', initialBuyIn, newPlayer.chips);
      updateTotalPot(newPlayersArray);
      toast({ title: "Player Added", description: `${name} joined with ${initialBuyIn} chips.` });
      return newPlayersArray;
    });
  }, [addTransactionEntry, updateTotalPot, toast]);

  const editPlayerName = useCallback((playerId: string, newName: string) => {
    if (!newName.trim()) {
      toast({ title: "Error", description: "Player name cannot be empty.", variant: "destructive" });
      return;
    }
    setPlayers(prevPlayers => prevPlayers.map(p => (p.id === playerId ? { ...p, name: newName } : p)));
    setTransactions(prevTransactions => prevTransactions.map(t => (t.playerId === playerId ? { ...t, playerName: newName } : t)));
    toast({ title: "Player Updated", description: `Player name changed to ${newName}.` });
  }, [toast]);

  const removePlayer = useCallback((playerId: string) => {
    setPlayers(prevPlayers => {
      const playerToRemove = prevPlayers.find(p => p.id === playerId);
      if (!playerToRemove) return prevPlayers;
      toast({ title: "Player Removed", description: `${playerToRemove.name} has been removed.` });
      // Note: totalPot will be updated naturally if the player had any totalInvested,
      // but for payout calculations, their investment remains. This function only removes them from active play.
      // If their investment should be removed from the pot, that's a different operation.
      // For now, let's assume their investment stays for payouts, and they are just inactive.
      // If investment should be removed:
      // const updatedPlayers = prevPlayers.filter(p => p.id !== playerId);
      // updateTotalPot(updatedPlayers);
      // return updatedPlayers;
      // Keeping them in for historical pot calculation unless specified otherwise for "remove"
      return prevPlayers.filter(p => p.id !== playerId);
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
      addTransactionEntry(player.id, player.name, type, amount, player.chips);
      updateTotalPot(updatedPlayers);
      toast({ title: "Transaction Complete", description: `${player.name}'s chips updated by ${type === 'rebuy' ? '+' : '-'}${amount}.` });
      return updatedPlayers;
    });
  }, [addTransactionEntry, updateTotalPot, toast]);

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
      addTransactionEntry(player.id, player.name, 'payout_adjustment', Math.abs(adjustmentAmount), player.chips);
      toast({ title: "Payout Adjusted", description: `${player.name}'s payout balance adjusted by ${adjustmentAmount}.` });
      return updatedPlayers;
    });
  }, [addTransactionEntry, toast]);

  const resetGame = useCallback(() => {
    setPlayers([]);
    setTransactions([]);
    setTotalPot(0);
    toast({ title: "New Game Started", description: "All previous game data has been cleared from current session." });
  }, [toast]);

  const saveGameToFirestore = async (): Promise<string | null> => {
    const db = getDb();
    if (!db) {
      toast({ title: "Sync Error", description: "Firestore is not initialized.", variant: "destructive" });
      return null;
    }
    if (players.length === 0) {
      toast({ title: "Save Error", description: "Cannot save an empty game (no players).", variant: "destructive" });
      return null;
    }
    setIsSyncing(true);
    try {
      const gameData: FirestoreGameData = {
        players,
        transactions,
        totalPot,
        savedAt: serverTimestamp(),
      };
      // Game ID will be generated by Firestore automatically
      const gameRef = await addDoc(collection(db, FIRESTORE_GAMES_COLLECTION_PATH), gameData);
      toast({ title: "Sync Success", description: `Game saved to Cloud with ID: ${gameRef.id}.` });
      return gameRef.id;
    } catch (error) {
      console.error("Error saving to Firestore:", error);
      toast({ title: "Sync Error", description: "Failed to save game data to Cloud.", variant: "destructive" });
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchSavedGames = async (): Promise<SavedGameSummary[]> => {
    const db = getDb();
    if (!db) {
      toast({ title: "Sync Error", description: "Firestore is not initialized.", variant: "destructive" });
      return [];
    }
    setIsSyncing(true);
    try {
      const gamesQuery = query(collection(db, FIRESTORE_GAMES_COLLECTION_PATH), orderBy("savedAt", "desc"));
      const querySnapshot = await getDocs(gamesQuery);
      const games: SavedGameSummary[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as FirestoreGameData;
        // Ensure savedAt is handled correctly (it could be Firestore Timestamp)
        let savedAtStr = "Unknown date";
        if (data.savedAt && typeof data.savedAt.toDate === 'function') {
          savedAtStr = data.savedAt.toDate().toLocaleString();
        } else if (data.savedAt) {
           try {
            savedAtStr = new Date(data.savedAt as string).toLocaleString();
           } catch (e) { /* ignore date parsing error, keep "Unknown date" */ }
        }

        games.push({
          id: docSnap.id,
          savedAt: savedAtStr,
          playerCount: data.players.length,
          totalPot: data.totalPot,
        });
      });
      return games;
    } catch (error) {
      console.error("Error fetching game list from Firestore:", error);
      toast({ title: "Sync Error", description: "Failed to fetch game list from Cloud.", variant: "destructive" });
      return [];
    } finally {
      setIsSyncing(false);
    }
  };

  const loadGameData = async (gameId: string): Promise<boolean> => {
    const db = getDb();
    if (!db) {
      toast({ title: "Sync Error", description: "Firestore is not initialized.", variant: "destructive" });
      return false;
    }
    setIsSyncing(true);
    try {
      const docRef = doc(db, FIRESTORE_GAMES_COLLECTION_PATH, gameId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const gameData = docSnap.data() as FirestoreGameData;
        setPlayers(gameData.players || []);
        setTransactions(gameData.transactions || []);
        setTotalPot(gameData.totalPot || 0);
        toast({ title: "Sync Success", description: `Game ${gameId} loaded from Cloud.` });
        return true;
      } else {
        toast({ title: "Sync Info", description: `Game ${gameId} not found in Cloud.`, variant: "destructive" });
        return false;
      }
    } catch (error) {
      console.error("Error loading game from Firestore:", error);
      toast({ title: "Sync Error", description: `Failed to load game ${gameId} from Cloud.`, variant: "destructive" });
      return false;
    } finally {
      setIsSyncing(false);
    }
  };


  return (
    <PokerLedgerContext.Provider value={{ 
      players, transactions, totalPot, addPlayer, editPlayerName, removePlayer, performTransaction, 
      adjustPayout, resetGame, isLoading, isSyncing, saveGameToFirestore, fetchSavedGames, loadGameData
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
