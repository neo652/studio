
"use client";

import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const formSchema = z.object({
  amount: z.coerce.number().positive("Amount must be a positive number."),
});

interface TransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
  playerName: string;
  transactionType: 'rebuy' | 'cut';
}

export function TransactionDialog({ isOpen, onClose, onSubmit, playerName, transactionType }: TransactionDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 100,
    },
  });

  const handleFormSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit(values.amount);
    form.reset();
    onClose();
  };
  
  const title = transactionType === 'rebuy' ? `Rebuy for ${playerName}` : `Cut Chips from ${playerName}`;
  const description = transactionType === 'rebuy' 
    ? `Enter the amount of chips ${playerName} is rebuying.`
    : `Enter the amount of chips to cut from ${playerName}'s stack.`;
  const buttonText = transactionType === 'rebuy' ? 'Process Rebuy' : 'Cut Chips';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { form.reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g. 50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { form.reset(); onClose(); }}>Cancel</Button>
              <Button type="submit">{buttonText}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
