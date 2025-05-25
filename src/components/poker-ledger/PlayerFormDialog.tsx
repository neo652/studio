
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { Player } from "@/types/poker";
import { useToast } from "@/hooks/use-toast";
import * as React from "react"; // Ensure React is imported for useState, useEffect

const DEFAULT_PLAYER_NAMES = ["Ankur", "Piyush", "Udit", "Nishant", "Ayush", "Anurag", "Mayur", "Vijay", "Anubhav", "Shaloo", "Shipra", "Seema", "Nikunj"];

// Schema for 'add' mode
const addModeFormSchema = z.object({
  customPlayerName: z.string().optional(),
  initialBuyIn: z.coerce.number().positive("Initial buy-in must be a positive number."),
});

// Schema for 'editName' mode
const editModeFormSchema = z.object({
  name: z.string().min(1, "Player name is required."),
});

// Combined type for form values, use appropriate one based on mode
type FormValues = z.infer<typeof addModeFormSchema> & z.infer<typeof editModeFormSchema>;

export interface PlayerFormDialogSubmitData {
  defaultPlayersToAdd?: string[];
  customPlayerName?: string;
  initialBuyIn?: number;
  editedName?: string;
}

interface PlayerFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PlayerFormDialogSubmitData) => void;
  mode: 'add' | 'editName';
  defaultValuesForEdit?: Partial<Player>;
  existingPlayerNamesWhileAdding?: string[]; // Lowercased names
}

export function PlayerFormDialog({
  isOpen,
  onClose,
  onSubmit,
  mode,
  defaultValuesForEdit,
  existingPlayerNamesWhileAdding = [],
}: PlayerFormDialogProps) {
  const { toast } = useToast();
  const [defaultPlayerSelections, setDefaultPlayerSelections] = React.useState<Record<string, boolean>>({});

  const currentFormSchema = mode === 'add' ? addModeFormSchema : editModeFormSchema;

  const form = useForm<FormValues>({
    resolver: zodResolver(currentFormSchema),
    // Default values are set in useEffect
  });

  React.useEffect(() => {
    if (isOpen) {
      if (mode === 'add') {
        form.reset({
          customPlayerName: "",
          initialBuyIn: 1000,
        });
        setDefaultPlayerSelections({});
      } else if (mode === 'editName') {
        form.reset({
          name: defaultValuesForEdit?.name || "",
        });
      }
    }
  }, [isOpen, mode, defaultValuesForEdit, form]);

  const handleDefaultPlayerSelect = (name: string, isSelected: boolean) => {
    setTimeout(() => {
      setDefaultPlayerSelections(prev => ({ ...prev, [name]: isSelected }));
    }, 0);
  };

  const handleFormSubmit = (values: FormValues) => {
    if (mode === 'add') {
      const selectedDefaultNames = Object.entries(defaultPlayerSelections)
        .filter(([_, isSelected]) => isSelected)
        .map(([name, _]) => name);

      const customName = values.customPlayerName?.trim() || "";
      const initialBuyIn = values.initialBuyIn!;

      if (selectedDefaultNames.length === 0 && !customName) {
        toast({
          title: "No Players Selected",
          description: "Please select at least one default player or enter a custom player name.",
          variant: "destructive",
        });
        return;
      }

      if (customName) {
        const lowerCustomName = customName.toLowerCase();
        if (existingPlayerNamesWhileAdding.includes(lowerCustomName) || selectedDefaultNames.some(dn => dn.toLowerCase() === lowerCustomName)) {
          form.setError("customPlayerName", {
            type: "manual",
            message: `Player name "${customName}" is already in use or selected.`,
          });
          return;
        }
      }
      
      onSubmit({ defaultPlayersToAdd: selectedDefaultNames, customPlayerName: customName, initialBuyIn });

    } else if (mode === 'editName') {
      onSubmit({ editedName: values.name });
    }
    // form.reset() is handled by useEffect when isOpen changes or mode changes
    // onClose(); // Let parent handle closing
  };
  
  const handleCloseDialog = () => {
    // Reset internal states before calling parent's onClose
    if (mode === 'add') {
      form.reset({ customPlayerName: "", initialBuyIn: 1000 });
      setDefaultPlayerSelections({});
    } else {
      form.reset({ name: defaultValuesForEdit?.name || "" });
    }
    onClose();
  };


  return (
    <Dialog open={isOpen} onOpenChange={(openState) => { if (!openState) { handleCloseDialog(); } }}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add Players' : 'Edit Player Name'}</DialogTitle>
          <DialogDescription>
            {mode === 'add' ? "Select default players or add a new custom player. The initial buy-in applies to all." : "Update the player's name."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            {mode === 'add' && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Select from default players</Label>
                  <ScrollArea className="h-[150px] w-full rounded-md border p-2">
                    <div className="space-y-2">
                      {DEFAULT_PLAYER_NAMES.map((name, index) => {
                        const isExisting = existingPlayerNamesWhileAdding.includes(name.toLowerCase());
                        return (
                          <div key={name} className="flex items-center space-x-2">
                            <Checkbox
                              id={`default-player-${index}`}
                              checked={!!defaultPlayerSelections[name] && !isExisting}
                              onCheckedChange={(checked) => handleDefaultPlayerSelect(name, !!checked)}
                              disabled={isExisting}
                            />
                            <Label htmlFor={`default-player-${index}`} className={isExisting ? "text-muted-foreground line-through" : ""}>
                              {name} {isExisting && "(In game)"}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Or add a custom player</Label>
                  <FormField
                    control={form.control}
                    name="customPlayerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Player Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. New Player" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="initialBuyIn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Buy-in (for all added players)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g. 1000" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {mode === 'editName' && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Player Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
              <Button type="submit">{mode === 'add' ? 'Add Selected Players' : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
