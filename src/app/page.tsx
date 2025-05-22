
import { PokerLedgerProvider } from "@/contexts/PokerLedgerContext";
import { Header } from "@/components/poker-ledger/Header";
import { PlayerManagement } from "@/components/poker-ledger/PlayerManagement";
import { TransactionLogs } from "@/components/poker-ledger/TransactionLogs";
import { PayoutCalculator } from "@/components/poker-ledger/PayoutCalculator";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientOnly } from "@/components/ClientOnly"; // To prevent hydration errors with localStorage access

export default function PokerLedgerPage() {
  return (
    <ClientOnly fallback={<AppSkeleton />}>
      <PokerLedgerProvider>
        <div className="min-h-screen flex flex-col">
          <div className="container mx-auto px-4 py-8 flex-grow">
            <Header />
            <main className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              <div className="lg:col-span-2 space-y-6 lg:space-y-8">
                <PlayerManagement />
                <TransactionLogs />
              </div>
              <div className="lg:col-span-1">
                <PayoutCalculator />
              </div>
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
        <Skeleton className="h-10 w-32" />
      </header>
      <main className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-6 lg:space-y-8">
          {/* Player Management Skeleton */}
          <div>
            <Skeleton className="h-12 w-1/2 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
          {/* Transaction Logs Skeleton */}
          <div>
            <Skeleton className="h-12 w-1/2 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
        <div className="lg:col-span-1">
          {/* Payout Calculator Skeleton */}
          <div>
            <Skeleton className="h-12 w-full mb-4" />
            <Skeleton className="h-80 w-full" />
          </div>
        </div>
      </main>
    </div>
  );
}
