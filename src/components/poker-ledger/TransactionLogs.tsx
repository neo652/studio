
"use client";

import { usePokerLedger } from "@/contexts/PokerLedgerContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TransactionType } from "@/types/poker";

const formatTimestamp = (isoString: string) => {
  return new Date(isoString).toLocaleString();
};

const getTransactionTypeBadgeVariant = (type: TransactionType): "default" | "secondary" | "destructive" | "outline" => {
  switch (type) {
    case 'buy-in':
      return 'default';
    case 'rebuy':
      return 'secondary'; // Theme dependent, currently a reddish-brown
    case 'cut':
      return 'destructive'; // Changed from 'outline' for better visual cue
    case 'payout_adjustment':
      return 'destructive'; 
    default:
      return 'default';
  }
}

export function TransactionLogs() {
  const { transactions } = usePokerLedger();

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <History className="h-6 w-6 text-primary" />
          <CardTitle>Transaction Log</CardTitle>
        </div>
        <CardDescription>A detailed record of all game actions.</CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No transactions recorded yet.</p>
        ) : (
          <ScrollArea className="h-[300px] sm:h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell px-2 sm:px-4">Timestamp</TableHead>
                  <TableHead className="px-2 sm:px-4">Player</TableHead>
                  <TableHead className="px-2 sm:px-4">Action</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">Amount</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">New Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id} className="table-row-hover">
                    <TableCell className="text-muted-foreground text-xs hidden md:table-cell py-2 px-2 sm:px-4">{formatTimestamp(transaction.timestamp)}</TableCell>
                    <TableCell className="py-2 px-2 sm:px-4">{transaction.playerName}</TableCell>
                    <TableCell className="py-2 px-2 sm:px-4">
                       <Badge variant={getTransactionTypeBadgeVariant(transaction.type)} className="capitalize">
                        {transaction.type.replace('_', ' ')}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-right py-2 px-2 sm:px-4">
                      {transaction.type === 'cut' || (transaction.type === 'payout_adjustment' && transaction.amount < 0) ? '-' : ''}
                      {Math.abs(transaction.amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right py-2 px-2 sm:px-4">{transaction.balanceAfter.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
