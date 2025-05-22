
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
import { useEffect } from "react";
import * as React from "react";

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
    // Default values are set in useEffect to correctly reflect transactionType
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        amount: transactionType === 'rebuy' ? 1000 : 1000, // Default cut chips also 1000
      });
    }
  }, [isOpen, transactionType, form]);

  const handleFormSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit(values.amount);
    // form.reset() will be handled by the effect or onOpenChange
    onClose();
  };
  
  const title = transactionType === 'rebuy' ? `Rebuy for ${playerName}` : `Cut Chips from ${playerName}`;
  const description = transactionType === 'rebuy' 
    ? `Enter the amount of chips ${playerName} is rebuying. Default is 1000.`
    : `Enter the amount of chips to cut from ${playerName}'s stack. Default is 1000.`;
  const buttonText = transactionType === 'rebuy' ? 'Process Rebuy' : 'Cut Chips';

  return (
    <Dialog open={isOpen} onOpenChange={(openState) => { 
      if (!openState) { 
        // form.reset is handled by useEffect when isOpen changes to false after being true
        onClose(); 
      } 
    }}>
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
                    <Input type="number" placeholder="e.g. 1000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { 
                onClose(); 
              }}>Cancel</Button>
              <Button type="submit">{buttonText}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

