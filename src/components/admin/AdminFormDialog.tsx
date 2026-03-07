import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Division {
  id: string;
  name: string;
}

interface AdminFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divisions: Division[];
  onSubmit: (data: {
    fullName: string;
    phone: string;
    password: string;
    divisionId: string;
    isReadOnly: boolean;
    cashCollectionEnabled: boolean;
  }) => Promise<void>;
  mode: "create" | "edit";
  initialData?: {
    fullName: string;
    phone: string;
    divisionId: string;
    isReadOnly: boolean;
    cashCollectionEnabled: boolean;
  };
}

export function AdminFormDialog({
  open,
  onOpenChange,
  divisions,
  onSubmit,
  mode,
  initialData,
}: AdminFormDialogProps) {
  const [fullName, setFullName] = useState(initialData?.fullName || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [password, setPassword] = useState("");
  const [divisionId, setDivisionId] = useState(initialData?.divisionId || "");
  const [isReadOnly, setIsReadOnly] = useState(initialData?.isReadOnly ?? false);
  const [cashCollectionEnabled, setCashCollectionEnabled] = useState(initialData?.cashCollectionEnabled ?? false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setPassword("");
    setDivisionId("");
    setIsReadOnly(false);
    setCashCollectionEnabled(false);
    setError("");
  };

  // Sync initial data when dialog opens with new data
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && initialData) {
      setFullName(initialData.fullName);
      setPhone(initialData.phone);
      setDivisionId(initialData.divisionId);
      setIsReadOnly(initialData.isReadOnly ?? false);
      setCashCollectionEnabled(initialData.cashCollectionEnabled ?? false);
      setPassword("");
      setError("");
    }
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await onSubmit({ fullName, phone, password, divisionId, isReadOnly, cashCollectionEnabled });
      handleOpenChange(false);
    } catch (err: any) {
      setError(err.message || `Failed to ${mode} admin`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCreate = mode === "create";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Create New Admin" : "Edit Admin"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Add a new administrator for a division"
              : "Update administrator details"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (for login)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                {isCreate ? "Password" : "New Password (leave blank to keep current)"}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required={isCreate}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="division">Primary Division</Label>
              <Select value={divisionId} onValueChange={setDivisionId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a division" />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((division) => (
                    <SelectItem key={division.id} value={division.id}>
                      {division.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="readOnly">Access Level</Label>
                <p className="text-xs text-muted-foreground">
                  {isReadOnly ? "Read Only — Can only view data" : "Full Access — Can create, edit & delete"}
                </p>
              </div>
              <Switch
                id="readOnly"
                checked={!isReadOnly}
                onCheckedChange={(checked) => setIsReadOnly(!checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="cashCollection">Cash Collection</Label>
                <p className="text-xs text-muted-foreground">
                  {cashCollectionEnabled ? "Enabled — Can verify collections & view reports" : "Disabled — No access to cash collections"}
                </p>
              </div>
              <Switch
                id="cashCollection"
                checked={cashCollectionEnabled}
                onCheckedChange={setCashCollectionEnabled}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isCreate ? "Creating..." : "Saving..."}
                </>
              ) : isCreate ? (
                "Create Admin"
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
