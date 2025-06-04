
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Player, Transaction, PokerState, PokerContextType, FirestoreGameData, SavedGameSummary, TransactionType } from '@/types/poker';
import { useToast } from '@/hooks/use-toast';
import { getDb } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp, collection, addDoc, getDocs, query, orderBy, Timestamp, updateDoc } from 'firebase/firestore';

const POKER_LEDGER_STORAGE_KEY = 'pokerLedgerState_v3_finalChips_netValueStored_multiGame_v2'; // Versioned key
const FIRESTORE_GAMES_COLLECTION_PATH = "pokerGames";

const PokerLedgerContext = createContext<PokerContextType | undefined>(undefined);

const generateId = () => crypto.randomUUID();

// Helper function for robust parsing of potentially numeric fields from Firestore or context
const parseNumericField = (value: any): number | null => {
  if (typeof value === 'number' && !isNaN(value)) { // Handles 0 correctly and NaN
    return value;
  }
  if (value === null || value === undefined || value === '') { // Treat empty string as null
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
};


export const PokerLedgerProvider = ({ children }: { children: ReactNode }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalPot, setTotalPot] = useState<number>(0);
  const [currentFirestoreGameId, setCurrentFirestoreGameId] = useState<string | null>(null);
  const [currentGameSavedAt, setCurrentGameSavedAt] = useState<string | null>(null); // Store ISO string
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false); // For global sync operations like save/load actual game
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    if (process.env.NODE_ENV === 'development') {
      console.log("Context: Attempting to load from localStorage with key:", POKER_LEDGER_STORAGE_KEY);
    }
    try {
      const storedState = localStorage.getItem(POKER_LEDGER_STORAGE_KEY);
      if (storedState) {
        const parsedState: PokerState = JSON.parse(storedState);
        if (process.env.NODE_ENV === 'development') {
          console.log("Context: Loaded from localStorage:", JSON.parse(JSON.stringify(parsedState)));
        }
        const loadedPlayers = (parsedState.players || []).map(p => ({
          id: p.id || generateId(),
          name: p.name || "Unknown Player",
          chips: Number(p.chips) || 0,
          totalInvested: Number(p.totalInvested) || 0,
          finalChips: parseNumericField(p.finalChips),
          netValueFromFinalChips: parseNumericField(p.netValueFromFinalChips),
        }));
        setPlayers(loadedPlayers);
        setTransactions(parsedState.transactions || []);
        setTotalPot(parsedState.totalPot || 0);
        setCurrentFirestoreGameId(parsedState.currentFirestoreGameId || null);
        setCurrentGameSavedAt(parsedState.currentGameSavedAt || null);
      } else {
         if (process.env.NODE_ENV === 'development') {
            console.log("Context: No state found in localStorage for key:", POKER_LEDGER_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error("Context: Failed to load state from localStorage", error);
      toast({ title: "Error", description: "Could not load saved game data from local storage.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]); // Only run on mount

  useEffect(() => {
    if (!isLoading) { // Only save if initial loading is complete
      try {
        const stateToStore: PokerState = {
            players,
            transactions,
            totalPot,
            currentFirestoreGameId,
            currentGameSavedAt
        };
        if (process.env.NODE_ENV === 'development') {
         // console.log("Context: Saving to localStorage:", JSON.parse(JSON.stringify(stateToStore)));
        }
        localStorage.setItem(POKER_LEDGER_STORAGE_KEY, JSON.stringify(stateToStore));
      } catch (error) {
        console.error("Context: Failed to save state to localStorage", error);
        // Optionally toast here, but can be noisy
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
        amount, // Store positive amount, type indicates direction
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
      const newPlayer: Player = {
        id: generateId(),
        name,
        chips: initialBuyIn,
        totalInvested: initialBuyIn,
        finalChips: null, // Initialize to null
        netValueFromFinalChips: null // Initialize to null
      };
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
    setTransactions(prevTransactions => prevTransactions.map(t => (t.playerId === playerId ? { ...t, playerName: newName } : t))); // Update name in transactions too
    toast({ title: "Player Updated", description: `Player name changed to ${newName}.` });
  }, [toast]);

  const removePlayer = useCallback((playerId: string) => {
    setPlayers(prevPlayers => {
      const playerToRemove = prevPlayers.find(p => p.id === playerId);
      if (!playerToRemove) return prevPlayers; // Should not happen if UI is correct
      
      const updatedPlayers = prevPlayers.filter(p => p.id !== playerId);
      updateTotalPot(updatedPlayers); // Recalculate pot based on remaining players
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
      const player = { ...updatedPlayers[playerIndex] }; // Create a mutable copy

      if (type === 'rebuy') {
        player.chips += amount;
        player.totalInvested += amount;
      } else if (type === 'cut') {
        player.chips -= amount; // Allow chips to go negative
        player.totalInvested -= amount; // Allow totalInvested to go negative
      }

      // Reset final chip stats as live chips have changed
      player.finalChips = null;
      player.netValueFromFinalChips = null;

      updatedPlayers[playerIndex] = player;
      addTransactionEntry(player.id, player.name, type, amount, player.chips);
      updateTotalPot(updatedPlayers);
      toast({ title: "Transaction Complete", description: `${player.name}'s chips updated by ${type === 'rebuy' ? '+' : '-'}${amount}. New balance: ${player.chips.toLocaleString()}.` });
      return updatedPlayers;
    });
  }, [addTransactionEntry, updateTotalPot, toast]);

  const updatePlayerFinalStats = useCallback((playerId: string, finalChipsVal: number | null, netValueVal: number | null) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`Context: updatePlayerFinalStats called for playerId: ${playerId}, finalChipsVal: ${finalChipsVal}, netValueVal: ${netValueVal}`);
    }
    setPlayers(prevPlayers =>
      prevPlayers.map(p =>
        p.id === playerId
          ? { ...p, finalChips: finalChipsVal, netValueFromFinalChips: netValueVal }
          : p
      )
    );
  }, []);

  const resetGame = useCallback(() => {
    setPlayers([]);
    setTransactions([]);
    setTotalPot(0);
    setCurrentFirestoreGameId(null);
    setCurrentGameSavedAt(null);
    // No need to clear localStorage manually, useEffect for saving will handle it with empty state
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
      if (process.env.NODE_ENV === 'development') {
        console.log("Context: Current players state for saveGameToFirestore:", JSON.parse(JSON.stringify(players)));
      }
      
      const sanitizedPlayersToSave = players.map(p => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`Context: Processing player ${p.name} for save. Raw context values - id: ${p.id}, chips: ${p.chips}, totalInvested: ${p.totalInvested}, finalChips: ${p.finalChips}, netValueFromFinalChips: ${p.netValueFromFinalChips}`);
        }
        const playerForDb: Player = {
          id: p.id,
          name: p.name,
          chips: Number(p.chips) || 0,
          totalInvested: Number(p.totalInvested) || 0,
          finalChips: parseNumericField(p.finalChips), 
          netValueFromFinalChips: parseNumericField(p.netValueFromFinalChips) 
        };
         if (process.env.NODE_ENV === 'development') {
            console.log(`Context: Player to save (inside map): ${p.name}`, JSON.parse(JSON.stringify(playerForDb)));
        }
        return playerForDb;
      });

      if (process.env.NODE_ENV === 'development') {
        console.log("Context: Sanitized players for Firestore (gameDataToSave.players):", JSON.parse(JSON.stringify(sanitizedPlayersToSave)));
      }

      const gameDataToSave: FirestoreGameData = {
        players: sanitizedPlayersToSave,
        transactions: transactions, // Use transactions from context state
        totalPot: totalPot, // Use totalPot from context state
        savedAt: serverTimestamp(), 
      };

      let gameRefId: string;
      const now = new Date();

      if (currentFirestoreGameId) {
        gameRefId = currentFirestoreGameId;
        const gameRef = doc(db, FIRESTORE_GAMES_COLLECTION_PATH, gameRefId);
        const existingSavedAt = currentGameSavedAt ? Timestamp.fromDate(new Date(currentGameSavedAt)) : gameDataToSave.savedAt;
        await setDoc(gameRef, { ...gameDataToSave, savedAt: existingSavedAt, lastUpdatedAt: serverTimestamp() });
        // No need to update currentGameSavedAt here because we preserve the original savedAt
        toast({ title: "Sync Success", description: `Game updated in Cloud (ID: ${gameRefId.substring(0,6)}...).` });
      } else {
        const newDocRef = await addDoc(collection(db, FIRESTORE_GAMES_COLLECTION_PATH), gameDataToSave);
        gameRefId = newDocRef.id;
        setCurrentFirestoreGameId(gameRefId);
        setCurrentGameSavedAt(now.toISOString()); 
        toast({ title: "Sync Success", description: `Game saved to Cloud with ID: ${gameRefId.substring(0,6)}...).` });
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

  const fetchSavedGames = useCallback(async (): Promise<SavedGameSummary[]> => {
    const db = getDb();
    if (!db) {
      toast({ title: "Sync Error", description: "Firestore is not initialized.", variant: "destructive" });
      return [];
    }
    try {
      const gamesQuery = query(collection(db, FIRESTORE_GAMES_COLLECTION_PATH), orderBy("savedAt", "desc"));
      const querySnapshot = await getDocs(gamesQuery);
      if (process.env.NODE_ENV === 'development') {
        console.log(`Context: fetchSavedGames - Fetched ${querySnapshot.size} game documents from Firestore.`);
      }
      const games: SavedGameSummary[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as FirestoreGameData;
        let savedAtStr = "Unknown date";
        const timestampToConvert = data.lastUpdatedAt || data.savedAt; 
        if (timestampToConvert instanceof Timestamp) {
          savedAtStr = timestampToConvert.toDate().toLocaleString();
        } else if (timestampToConvert && typeof (timestampToConvert as any).toDate === 'function') {
          savedAtStr = (timestampToConvert as any).toDate().toLocaleString();
        } else if (timestampToConvert) {
           try { savedAtStr = new Date(timestampToConvert as any).toLocaleString(); } catch (e) {/* ignore */}
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
    }
  }, [toast]); 

  const fetchRecentSavedGamesForLoadDialog = useCallback(async (): Promise<SavedGameSummary[]> => {
    const allGames = await fetchSavedGames();
    return allGames.slice(0, 2);
  }, [fetchSavedGames]);

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
        if (process.env.NODE_ENV === 'development') {
          console.log(`Context: Loading game ${gameId} from Firestore. Raw data:`, JSON.parse(JSON.stringify(gameData)));
        }
        const loadedPlayers = (gameData.players || []).map(p => ({
          id: p.id || generateId(),
          name: p.name || "Unknown Player",
          chips: parseNumericField(p.chips) ?? 0,
          totalInvested: parseNumericField(p.totalInvested) ?? 0,
          finalChips: parseNumericField(p.finalChips),
          netValueFromFinalChips: parseNumericField(p.netValueFromFinalChips),
        }));
        if (process.env.NODE_ENV === 'development') {
          console.log(`Context: Parsed players for context after loading game ${gameId}:`, JSON.parse(JSON.stringify(loadedPlayers)));
        }

        setPlayers(loadedPlayers);
        setTransactions(gameData.transactions || []);
        setTotalPot(gameData.totalPot || 0);
        setCurrentFirestoreGameId(gameId);

        let loadedGameSavedAtStr = new Date().toISOString(); 
        const firestoreSavedAt = gameData.savedAt; 
        if (firestoreSavedAt instanceof Timestamp) {
            loadedGameSavedAtStr = firestoreSavedAt.toDate().toISOString();
        } else if (firestoreSavedAt && typeof (firestoreSavedAt as any).toDate === 'function') {
            loadedGameSavedAtStr = (firestoreSavedAt as any).toDate().toISOString();
        } else if (firestoreSavedAt) {
            try { loadedGameSavedAtStr = new Date(firestoreSavedAt as any).toISOString(); } catch (e) { /* use default */ }
        }
        setCurrentGameSavedAt(loadedGameSavedAtStr);

        toast({ title: "Sync Success", description: `Game ${gameId.substring(0,6)}... loaded from Cloud.` });
        return true;
      } else {
        toast({ title: "Sync Info", description: `Game ${gameId.substring(0,6)}... not found in Cloud.`, variant: "destructive" });
        return false;
      }
    } catch (error) {
      console.error("Error loading game from Firestore:", error);
      toast({ title: "Sync Error", description: `Failed to load game ${gameId.substring(0,6)}... from Cloud.`, variant: "destructive" });
      return false;
    } finally {
      setIsSyncing(false);
    }
  };


  const contextValue = {
      players, transactions, totalPot, addPlayer, editPlayerName, removePlayer, performTransaction,
      resetGame, isLoading, isSyncing, saveGameToFirestore, fetchSavedGames,
      fetchRecentSavedGamesForLoadDialog, // Add new function here
      loadGameData,
      currentFirestoreGameId, currentGameSavedAt, updatePlayerFinalStats
  };

  return (
    <PokerLedgerContext.Provider value={contextValue}>
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
    
