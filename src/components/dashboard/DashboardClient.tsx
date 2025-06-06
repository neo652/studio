
"use client";

import * as React from "react";
import { getDb } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import type { SavedGameDocument, PlayerInGameStats, PlayerLifetimeStats, Player as PlayerType } from "@/types/poker";
import { GameStatsTable } from "./GameStatsTable";
import { LifetimeStatsTable } from "./LifetimeStatsTable";
import { LifetimeStatsChart } from "./LifetimeStatsChart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart3, Users, TrendingUp, LineChart } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DASHBOARD_CHIP_VALUE = 1;

const parseNumericField = (value: any): number | null => {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
};

export function DashboardClient() {
  const [games, setGames] = React.useState<SavedGameDocument[]>([]);
  const [selectedGameId, setSelectedGameId] = React.useState<string | null>(null);
  const [isLoadingGames, setIsLoadingGames] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [playerGameStats, setPlayerGameStats] = React.useState<PlayerInGameStats[]>([]);
  
  const [apiLifetimeStats, setApiLifetimeStats] = React.useState<PlayerLifetimeStats[]>([]);
  const [isLoadingLifetime, setIsLoadingLifetime] = React.useState(true);
  const [lifetimeStatsError, setLifetimeStatsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchGames = async () => {
      setIsLoadingGames(true);
      setError(null);
      const db = getDb();
      if (!db) {
        setError("Firestore is not initialized. Cannot load dashboard data.");
        setIsLoadingGames(false);
        return;
      }

      try {
        const gamesQuery = query(collection(db, "pokerGames"), orderBy("savedAt", "desc"));
        const querySnapshot = await getDocs(gamesQuery);
        const fetchedGames: SavedGameDocument[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          let savedAtDate = new Date();
          const firestoreTimestamp = data.lastUpdatedAt || data.savedAt;

          if (firestoreTimestamp instanceof Timestamp) {
            savedAtDate = firestoreTimestamp.toDate();
          } else if (typeof firestoreTimestamp === 'string' || typeof firestoreTimestamp === 'number') {
             try { savedAtDate = new Date(firestoreTimestamp); } catch (e) {/* use default */}
          } else if (firestoreTimestamp && firestoreTimestamp.seconds) {
             try { savedAtDate = new Date(firestoreTimestamp.seconds * 1000); } catch (e) {/* use default */}
          }
          
          const loadedPlayers = (data.players || []).map((p: any): PlayerType => ({
            id: p.id || `unknown-${Math.random()}`,
            name: p.name || "Unknown Player",
            chips: parseNumericField(p.chips) ?? 0,
            totalInvested: parseNumericField(p.totalInvested) ?? 0,
            finalChips: parseNumericField(p.finalChips),
            netValueFromFinalChips: parseNumericField(p.netValueFromFinalChips),
          }));
          
          fetchedGames.push({
            id: doc.id,
            players: loadedPlayers,
            transactions: data.transactions || [],
            totalPot: data.totalPot || 0,
            savedAt: savedAtDate.toISOString(),
            lastUpdatedAt: data.lastUpdatedAt ? (data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt.toDate().toISOString() : new Date(data.lastUpdatedAt as any).toISOString()) : undefined,
          });
        });
        setGames(fetchedGames);
        if (fetchedGames.length > 0) {
          setSelectedGameId(fetchedGames[0].id);
        }
      } catch (e) {
        console.error("Error fetching games for dashboard:", e);
        setError("Failed to load game data from Firestore.");
      } finally {
        setIsLoadingGames(false);
      }
    };

    fetchGames();
  }, []);

  React.useEffect(() => {
    const fetchLifetimeStats = async () => {
      setIsLoadingLifetime(true);
      setLifetimeStatsError(null);
      try {
        const response = await fetch('/api/lifetime-stats');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "Unknown server error."}));
          throw new Error(`Failed to fetch lifetime stats. Server responded with ${response.status}. ${errorData.detail || ''}`);
        }
        const data: PlayerLifetimeStats[] = await response.json();
        setApiLifetimeStats(data);
      } catch (err: any) {
        console.error("Dashboard: Error fetching lifetime stats:", err);
        setLifetimeStatsError(err.message || "An unknown error occurred.");
      } finally {
        setIsLoadingLifetime(false);
      }
    };
    fetchLifetimeStats();
  }, []);


  React.useEffect(() => {
    if (!selectedGameId || games.length === 0) {
      setPlayerGameStats([]);
      return;
    }

    const selectedGame = games.find(g => g.id === selectedGameId);
    if (selectedGame && Array.isArray(selectedGame.players)) {
      const stats: PlayerInGameStats[] = selectedGame.players.map(player => {
        const pName = player.name || "Unknown Player";
        const pTotalInvested = parseNumericField(player.totalInvested) ?? 0;
        let netVal: number;

        const pNetFromFinal = parseNumericField(player.netValueFromFinalChips);
        const pFinalChips = parseNumericField(player.finalChips);
        const pLiveChips = parseNumericField(player.chips) ?? 0;

        if (typeof pNetFromFinal === 'number') {
          netVal = pNetFromFinal;
        } else if (typeof pFinalChips === 'number') {
          netVal = (pFinalChips * DASHBOARD_CHIP_VALUE) - pTotalInvested;
        } else {
          // Fallback to live chips if no final chip data is available.
          netVal = (pLiveChips * DASHBOARD_CHIP_VALUE) - pTotalInvested;
        }
        
        if (process.env.NODE_ENV === 'development' && pName === 'Mayur' && selectedGame.id === 'S0yDJsx0tSKbwIfGomC0') { // Example debug condition
            console.log(`DashboardClient - Game ${selectedGame.id}, Player: ${pName}
            - Raw chips from Firestore: ${player.chips}, Parsed Live: ${pLiveChips}
            - Raw totalInvested from Firestore: ${player.totalInvested}, Parsed Invested: ${pTotalInvested}
            - Raw finalChips from Firestore: ${player.finalChips}, Parsed Final: ${pFinalChips}
            - Raw netValueFromFinalChips from Firestore: ${player.netValueFromFinalChips}, Parsed NetFromFinal: ${pNetFromFinal}
            - Calculated Net Value for GameStatsTable: ${netVal}`);
        }
        
        return {
          playerName: pName,
          netValue: netVal,
        };
      }).sort((a,b) => b.netValue - a.netValue);
      setPlayerGameStats(stats);
    } else {
      setPlayerGameStats([]);
    }
  }, [selectedGameId, games]);

  const allPlayerNamesForChart = React.useMemo(() => {
    if (games.length === 0) return [];
    const playerNames = new Set<string>();
    games.forEach(game => {
      if (Array.isArray(game.players)) {
        game.players.forEach(player => {
          if (player && typeof player.name === 'string') {
            playerNames.add(player.name);
          }
        });
      }
    });
    return Array.from(playerNames).sort().map(name => ({ playerName: name }));
  }, [games]);


  if (isLoadingGames) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive text-center">{error}</p>;
  }

  if (games.length === 0 && !isLoadingGames) {
    return <p className="text-muted-foreground text-center">No game data found in Firestore to display on the dashboard.</p>;
  }

  return (
    <div className="space-y-8">
      {games.length > 0 && allPlayerNamesForChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><LineChart className="mr-2 h-6 w-6 text-primary"/>Player Game-by-Game Performance</CardTitle>
            <CardDescription>Select a player to view their net win/loss for each game.</CardDescription>
          </CardHeader>
          <CardContent>
             <LifetimeStatsChart stats={allPlayerNamesForChart} allGamesData={games} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-6 w-6 text-primary"/>Game Statistics</CardTitle>
          <CardDescription>Select a game to view its player net values. Chip value for dashboard net calculations is fixed at ₹{DASHBOARD_CHIP_VALUE}.</CardDescription>
          <div className="mt-4">
            <label htmlFor="game-selector" className="block text-sm font-medium text-muted-foreground mb-1">
              Select Game (Newest First)
            </label>
            <Select
              value={selectedGameId || ""}
              onValueChange={(value) => setSelectedGameId(value)}
              disabled={games.length === 0}
            >
              <SelectTrigger id="game-selector" className="w-full md:w-1/2 lg:w-1/3">
                <SelectValue placeholder="Select a game..." />
              </SelectTrigger>
              <SelectContent>
                {games.map(game => (
                  <SelectItem key={game.id} value={game.id}>
                    Game saved: {new Date(game.savedAt).toLocaleString()} (Pot: ₹{game.totalPot.toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {selectedGameId && games.find(g => g.id === selectedGameId) ? (
            <>
              <p className="text-sm text-muted-foreground mb-2">
                Displaying stats for game saved on: {new Date(games.find(g => g.id === selectedGameId)!.savedAt).toLocaleString()}
              </p>
              <GameStatsTable stats={playerGameStats} />
            </>
          ) : (
            <p className="text-muted-foreground text-center py-4">Select a game to view its statistics.</p>
          )}
        </CardContent>
      </Card>
      
      <Card>
          <CardHeader>
             <CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-primary"/>Lifetime Player Stats</CardTitle>
             <CardDescription>Aggregated performance summary across all saved games.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingLifetime && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                <p>Loading lifetime stats...</p>
              </div>
            )}
            {lifetimeStatsError && !isLoadingLifetime && (
              <Alert variant="destructive">
                <AlertTitle>Error Loading Lifetime Stats</AlertTitle>
                <AlertDescription>{lifetimeStatsError}</AlertDescription>
              </Alert>
            )}
             {!isLoadingLifetime && !lifetimeStatsError && (
              apiLifetimeStats.length > 0 ? (
                <LifetimeStatsTable stats={apiLifetimeStats} />
              ) : (
                 <p className="text-muted-foreground text-center py-4">No lifetime player data available or failed to load.</p>
              )
            )}
          </CardContent>
      </Card>
    </div>
  );
}

    
