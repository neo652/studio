
import { PokerLedgerProvider } from "@/contexts/PokerLedgerContext";
import { Header } from "@/components/poker-ledger/Header";
import { PlayerManagement } from "@/components/poker-ledger/PlayerManagement";
import { TransactionLogs } from "@/components/poker-ledger/TransactionLogs";
import { PayoutCalculator } from "@/components/poker-ledger/PayoutCalculator";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientOnly } from "@/components/ClientOnly"; // To prevent hydration errors with localStorage access
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PokerLedgerPage() {
  return (
    <ClientOnly fallback={<AppSkeleton />}>
      <PokerLedgerProvider>
        <div className="min-h-screen flex flex-col">
          <div className="container mx-auto px-4 py-8 flex-grow">
            <Header pageType="main" /> {/* Explicitly set pageType for clarity */}
            <main className="mt-8">
              <Tabs defaultValue="playerManagement" className="w-full">
                <TabsList className="mb-6 flex w-full flex-col gap-1 rounded-md bg-muted p-1 sm:h-10 sm:flex-row">
                  <TabsTrigger value="playerManagement" className="w-full sm:w-auto">Player Management</TabsTrigger>
                  <TabsTrigger value="payoutCalculator" className="w-full sm:w-auto">Final Payouts</TabsTrigger>
                  <TabsTrigger value="transactionLogs" className="w-full sm:w-auto">Transaction Log</TabsTrigger>
                </TabsList>
                <TabsContent value="playerManagement">
                  <PlayerManagement />
                </TabsContent>
                <TabsContent value="payoutCalculator">
                  <PayoutCalculator />
                </TabsContent>
                <TabsContent value="transactionLogs">
                  <TransactionLogs />
                </TabsContent>
              </Tabs>
            </main>
          </div>
          <footer className="text-center p-4 text-sm text-muted-foreground border-t">
            Poker Ledger &copy; {new Date().getFullYear()}
          </footer>
        </div>
      </PokerLedgerProvider>
    </ClientOnly>
  );
}

function AppSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row justify-between items-center pb-6 border-b-2 border-primary">
        <div className="flex items-center space-x-3 mb-4 sm:mb-0">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="flex items-center space-x-2">
            <Skeleton className="h-10 w-28" /> {/* Dashboard */}
            <Skeleton className="h-10 w-24" /> {/* Load */}
            <Skeleton className="h-10 w-24" /> {/* Save/Update */}
            <Skeleton className="h-10 w-32" /> {/* New Game */}
         </div>
      </header>
      <main className="mt-8">
        {/* Tab Triggers Skeleton */}
        <div className="mb-6 flex w-full flex-col gap-1 rounded-md bg-muted p-1 sm:h-10 sm:flex-row">
          <Skeleton className="h-8 w-full rounded-sm bg-background sm:h-full sm:flex-1" /> {/* Player Management */}
          <Skeleton className="h-8 w-full rounded-sm bg-background sm:h-full sm:flex-1" /> {/* Final Payouts */}
          <Skeleton className="h-8 w-full rounded-sm bg-background sm:h-full sm:flex-1" /> {/* Transaction Log */}
        </div>
        {/* Tab Content Area Skeleton */}
        <div>
          <Skeleton className="h-12 w-1/2 mb-4" /> {/* Placeholder for section title within content */}
          <Skeleton className="h-[400px] w-full" /> {/* Placeholder for section content */}
        </div>
      </main>
    </div>
  );
}
