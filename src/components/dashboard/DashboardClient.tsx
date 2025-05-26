
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
import { Loader2, BarChart3, Users, Eye, LineChart as TrendIcon } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DASHBOARD_CHIP_VALUE = 1; 

const parseNumericField = (value: any): number | null => {
  if (typeof value === 'number') { 
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
  const [isLoadingLifetimeStats, setIsLoadingLifetimeStats] = React.useState(false);
  const [lifetimeStatsError, setLifetimeStatsError] = React.useState<string | null>(null);
  const [areLifetimeStatsVisible, setAreLifetimeStatsVisible] = React.useState(false);


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
          
          if (process.env.NODE_ENV === 'development' && doc.id === 'S0yDJsx0tSKbwIfGomC0') {
            console.log(`Dashboard Fetch (Game S0yDJsx0tSKbwIfGomC0): Raw players data from Firestore:`, JSON.parse(JSON.stringify(data.players)));
            console.log(`Dashboard Fetch (Game S0yDJsx0tSKbwIfGomC0): Parsed players for context:`, JSON.parse(JSON.stringify(loadedPlayers)));
          }


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
    if (!selectedGameId || games.length === 0) {
      setPlayerGameStats([]);
      return;
    }

    const selectedGame = games.find(g => g.id === selectedGameId);
    if (selectedGame && Array.isArray(selectedGame.players)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Dashboard: Calculating Game Stats for game ID: ${selectedGame.id}. Full game object:`, JSON.parse(JSON.stringify(selectedGame)));
        selectedGame.players.forEach(player => {
            console.log(`Dashboard: Game Stats - Player ${player.name} (Game ${selectedGame.id}): Chips from Firestore: ${player.chips}, Total Invested from Firestore: ${player.totalInvested}, Parsed Final Chips: ${player.finalChips}, Parsed Net Value from Final Chips: ${player.netValueFromFinalChips}`);
        });
      }

      const stats: PlayerInGameStats[] = selectedGame.players.map(player => {
        const pName = player.name || "Unknown Player";
        const pTotalInvested = parseNumericField(player.totalInvested) ?? 0;
        let netVal: number;

        const pNetFromFinal = parseNumericField(player.netValueFromFinalChips);
        const pFinalChips = parseNumericField(player.finalChips);
        const pLiveChips = parseNumericField(player.chips) ?? 0;

        if (typeof pNetFromFinal === 'number') {
          netVal = pNetFromFinal;
           if (process.env.NODE_ENV === 'development') {
            console.log(`Dashboard Game Stats for ${pName} (Game ${selectedGame.id}): Using netValueFromFinalChips (${typeof pNetFromFinal}): ${netVal}`);
          }
        } else if (typeof pFinalChips === 'number') {
          netVal = (pFinalChips * DASHBOARD_CHIP_VALUE) - pTotalInvested;
          if (process.env.NODE_ENV === 'development') {
            console.log(`Dashboard Game Stats for ${pName} (Game ${selectedGame.id}): Using finalChips (${typeof pFinalChips}): ${pFinalChips}, Invested: ${pTotalInvested}, Calculated Net: ${netVal}`);
          }
        } else {
          netVal = (pLiveChips * DASHBOARD_CHIP_VALUE) - pTotalInvested;
          if (process.env.NODE_ENV === 'development') {
            console.log(`Dashboard Game Stats for ${pName} (Game ${selectedGame.id}): Using live chips (${typeof pLiveChips}): ${pLiveChips}, Invested: ${pTotalInvested}, Calculated Net: ${netVal}`);
          }
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


  const handleFetchLifetimeStats = async () => {
    setIsLoadingLifetimeStats(true);
    setLifetimeStatsError(null);
    setApiLifetimeStats([]); 
    try {
      const response = await fetch('/api/lifetime-stats');
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed or was cancelled. Please try again if you wish to view lifetime stats.');
        }
        const errorData = await response.json().catch(() => ({ detail: "Unknown server error."}));
        throw new Error(`Failed to fetch lifetime stats. Server responded with ${response.status}. ${errorData.detail || ''}`);
      }
      const data: PlayerLifetimeStats[] = await response.json();
      setApiLifetimeStats(data);
      setAreLifetimeStatsVisible(true); 
    } catch (err: any) {
      console.error("Dashboard: Error fetching lifetime stats:", err);
      setLifetimeStatsError(err.message || "An unknown error occurred.");
      setAreLifetimeStatsVisible(false); 
    } finally {
      setIsLoadingLifetimeStats(false);
    }
  };


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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-6 w-6 text-primary"/>Game Statistics Dashboard</CardTitle>
          <CardDescription>Select a game to view its details. Lifetime statistics require authentication. Chip value for dashboard net calculations is fixed at ₹{DASHBOARD_CHIP_VALUE}.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
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
        </CardContent>
      </Card>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary"/>Selected Game Stats</CardTitle>
            {selectedGameId && games.find(g => g.id === selectedGameId) && (
                 <CardDescription>
                    Details for game saved on: {new Date(games.find(g => g.id === selectedGameId)!.savedAt).toLocaleString()}
                 </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedGameId ? (
              <GameStatsTable stats={playerGameStats} />
            ) : (
              <p className="text-muted-foreground">Select a game to view its statistics.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
             <CardTitle className="flex items-center"><TrendIcon className="mr-2 h-5 w-5 text-primary"/>Lifetime Player Stats & Trends</CardTitle> 
             <CardDescription>Aggregated performance and game-by-game trends. Requires authentication.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!areLifetimeStatsVisible && !isLoadingLifetimeStats && !lifetimeStatsError && (
              <Button onClick={handleFetchLifetimeStats}>
                <Eye className="mr-2 h-4 w-4" /> Show Lifetime Stats & Trends
              </Button>
            )}
            {isLoadingLifetimeStats && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                <p>Loading lifetime stats...</p>
              </div>
            )}
            {lifetimeStatsError && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{lifetimeStatsError}</AlertDescription>
              </Alert>
            )}
            {areLifetimeStatsVisible && !isLoadingLifetimeStats && !lifetimeStatsError && (
              apiLifetimeStats.length > 0 ? (
                <>
                  <LifetimeStatsChart stats={apiLifetimeStats} allGamesData={games} />
                  <div className="mt-6"> {/* Added margin-top for spacing */}
                    <LifetimeStatsTable stats={apiLifetimeStats} />
                  </div>
                </>
              ) : (
                 <p className="text-muted-foreground text-center py-4">No lifetime player data available or authentication failed.</p>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

