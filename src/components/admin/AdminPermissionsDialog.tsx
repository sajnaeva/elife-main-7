import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Building2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Division {
  id: string;
  name: string;
}

interface AdminPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admin: {
    id: string;
    full_name?: string | null;
    division_id: string;
    access_all_divisions?: boolean;
    additional_division_ids?: string[];
    cash_collection_enabled?: boolean;
    cash_collection_division_ids?: string[];
  } | null;
  divisions: Division[];
  onSaved: () => void;
}

export function AdminPermissionsDialog({
  open,
  onOpenChange,
  admin,
  divisions,
  onSaved,
}: AdminPermissionsDialogProps) {
  const [accessAll, setAccessAll] = useState(false);
  const [selectedDivisionIds, setSelectedDivisionIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (admin) {
      setAccessAll(admin.access_all_divisions ?? false);
      setSelectedDivisionIds(admin.additional_division_ids ?? []);
    }
  }, [admin]);

  const handleToggleDivision = (divisionId: string) => {
    setSelectedDivisionIds((prev) =>
      prev.includes(divisionId)
        ? prev.filter((id) => id !== divisionId)
        : [...prev, divisionId]
    );
  };

  const handleSelectAll = () => {
    const otherDivisionIds = divisions
      .filter((d) => d.id !== admin?.division_id)
      .map((d) => d.id);
    
    if (selectedDivisionIds.length === otherDivisionIds.length) {
      setSelectedDivisionIds([]);
    } else {
      setSelectedDivisionIds(otherDivisionIds);
    }
  };

  const handleSave = async () => {
    if (!admin) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("admins")
        .update({
          access_all_divisions: accessAll,
          additional_division_ids: accessAll ? [] : selectedDivisionIds,
        } as any)
        .eq("id", admin.id);

      if (error) throw error;

      toast({
        title: "Permissions updated",
        description: `Permissions for ${admin.full_name || "admin"} have been saved.`,
      });

      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update permissions",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!admin) return null;

  const primaryDivision = divisions.find((d) => d.id === admin.division_id);
  const otherDivisions = divisions.filter((d) => d.id !== admin.division_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Manage Permissions
          </DialogTitle>
          <DialogDescription>
            Configure division access for{" "}
            <span className="font-medium text-foreground">
              {admin.full_name || "Admin"}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Primary Division (read-only) */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Primary Division</span>
              </div>
              <Badge variant="default" className="text-xs">
                {primaryDivision?.name || "Unknown"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              This is the admin's assigned division and cannot be changed here.
            </p>
          </div>

          <Separator />

          {/* Access All Divisions Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="access-all" className="text-sm font-medium">
                Access All Divisions
              </Label>
              <p className="text-xs text-muted-foreground">
                Grant full access to every division in the system
              </p>
            </div>
            <Switch
              id="access-all"
              checked={accessAll}
              onCheckedChange={setAccessAll}
            />
          </div>

          {/* Individual Division Selection */}
          {!accessAll && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Additional Division Access
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSelectAll}
                >
                  {selectedDivisionIds.length === otherDivisions.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>
              <ScrollArea className="h-[200px] rounded-lg border p-2">
                <div className="space-y-1">
                  {otherDivisions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No other divisions available
                    </p>
                  ) : (
                    otherDivisions.map((division) => (
                      <label
                        key={division.id}
                        className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedDivisionIds.includes(division.id)}
                          onCheckedChange={() => handleToggleDivision(division.id)}
                        />
                        <span className="text-sm">{division.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
              {selectedDivisionIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedDivisionIds.length} additional division
                  {selectedDivisionIds.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Permissions"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
