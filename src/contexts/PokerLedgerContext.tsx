
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Player, Transaction, PokerState, PokerContextType, FirestoreGameData, SavedGameSummary, TransactionType } from '@/types/poker';
import { useToast } from '@/hooks/use-toast';
import { getDb } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp, collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';

const POKER_LEDGER_STORAGE_KEY = 'pokerLedgerState_v2'; // Increment version to avoid conflicts with old structure
const FIRESTORE_GAMES_COLLECTION_PATH = "pokerGames";

const PokerLedgerContext = createContext<PokerContextType | undefined>(undefined);

const generateId = () => crypto.randomUUID();

export const PokerLedgerProvider = ({ children }: { children: ReactNode }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalPot, setTotalPot] = useState<number>(0);
  const [currentFirestoreGameId, setCurrentFirestoreGameId] = useState<string | null>(null);
  const [currentGameSavedAt, setCurrentGameSavedAt] = useState<string | null>(null);
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
        setCurrentFirestoreGameId(parsedState.currentFirestoreGameId || null);
        setCurrentGameSavedAt(parsedState.currentGameSavedAt || null);
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
        const stateToStore: PokerState = { 
            players, 
            transactions, 
            totalPot, 
            currentFirestoreGameId,
            currentGameSavedAt 
        };
        localStorage.setItem(POKER_LEDGER_STORAGE_KEY, JSON.stringify(stateToStore));
      } catch (error) {
        console.error("Failed to save state to localStorage", error);
      }
    }
  }, [players, transactions, totalPot, currentFirestoreGameId, currentGameSavedAt, isLoading]);

  const updateTotalPot = useCallback((updatedPlayersList: Player[]) => {
    const newTotalPot = updatedPlayersList.reduce((sum, player) => sum + player.totalInvested, 0);
    setTotalPot(newTotalPot);
  }, []);

  const addTransactionEntry = useCallback((playerId: string, playerName: string, type: TransactionType, amount: number, balanceAfter: number) => {
    setTransactions(prevTransactions => {
      const newTransaction: Transaction = {
        id: generateId(),
        playerId,
        playerName,
        type,
        amount,
        balanceAfter,
        timestamp: new Date().toISOString(),
      };
      return [newTransaction, ...prevTransactions];
    });
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
      addTransactionEntry(newPlayer.id, newPlayer.name, 'buy-in', initialBuyIn, newPlayer.chips);
      const newPlayersArray = [...prevPlayers, newPlayer];
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
      
      const updatedPlayers = prevPlayers.filter(p => p.id !== playerId);
      updateTotalPot(updatedPlayers); // Update total pot based on remaining players
      
      toast({ title: "Player Removed", description: `${playerToRemove.name} has been removed.` });
      return updatedPlayers;
    });
  }, [updateTotalPot, toast]);


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
    setCurrentFirestoreGameId(null);
    setCurrentGameSavedAt(null);
    toast({ title: "New Game Started", description: "All previous game data has been cleared from current session." });
  }, [toast]);

  const saveGameToFirestore = async (playersToSave: Player[], transactionsToSave: Transaction[], currentTotalPot: number): Promise<string | null> => {
    const db = getDb();
    if (!db) {
      toast({ title: "Sync Error", description: "Firestore is not initialized.", variant: "destructive" });
      return null;
    }
    if (playersToSave.length === 0) {
      toast({ title: "Save Error", description: "Cannot save an empty game (no players).", variant: "destructive" });
      return null;
    }
    setIsSyncing(true);
    try {
      const gameDataToSave: FirestoreGameData = {
        players: playersToSave,
        transactions: transactionsToSave,
        totalPot: currentTotalPot,
        savedAt: serverTimestamp(), // Will be set for new games, may be overwritten for updates by lastUpdatedAt
      };

      let gameRefId: string;
      const now = new Date();

      if (currentFirestoreGameId) {
        // Update existing document
        gameRefId = currentFirestoreGameId;
        const gameRef = doc(db, FIRESTORE_GAMES_COLLECTION_PATH, gameRefId);
        await setDoc(gameRef, { ...gameDataToSave, lastUpdatedAt: serverTimestamp() }, { merge: true }); // Use merge to not overwrite original savedAt
        toast({ title: "Sync Success", description: `Game updated in Cloud (ID: ${gameRefId}).` });
        setCurrentGameSavedAt(now.toISOString()); // Update local 'savedAt' to reflect update time
      } else {
        // Add new document
        const newDocRef = await addDoc(collection(db, FIRESTORE_GAMES_COLLECTION_PATH), gameDataToSave);
        gameRefId = newDocRef.id;
        setCurrentFirestoreGameId(gameRefId); // Track the new game ID
        setCurrentGameSavedAt(now.toISOString()); // Set local 'savedAt' to current time
        toast({ title: "Sync Success", description: `Game saved to Cloud with ID: ${gameRefId}.` });
      }
      return gameRefId;
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
        let savedAtStr = "Unknown date";
        // Prefer lastUpdatedAt if available, otherwise savedAt
        const timestampToConvert = data.lastUpdatedAt || data.savedAt;
        if (timestampToConvert && typeof timestampToConvert.toDate === 'function') {
          savedAtStr = timestampToConvert.toDate().toLocaleString();
        } else if (timestampToConvert) { // Fallback for string or number timestamp (less likely with serverTimestamp)
           try {
            savedAtStr = new Date(timestampToConvert as string | number).toLocaleString();
           } catch (e) { /* ignore */ }
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
        setCurrentFirestoreGameId(gameId);

        let loadedGameSavedAtStr = new Date().toISOString(); // Default to now if no valid date
        const timestampToConvert = gameData.lastUpdatedAt || gameData.savedAt;
        if (timestampToConvert instanceof Timestamp) {
            loadedGameSavedAtStr = timestampToConvert.toDate().toISOString();
        } else if (timestampToConvert) {
            try {
                loadedGameSavedAtStr = new Date(timestampToConvert).toISOString();
            } catch (e) { /* use default */ }
        }
        setCurrentGameSavedAt(loadedGameSavedAtStr);

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
      adjustPayout, resetGame, isLoading, isSyncing, saveGameToFirestore, fetchSavedGames, loadGameData,
      currentFirestoreGameId, currentGameSavedAt
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
