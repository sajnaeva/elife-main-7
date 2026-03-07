import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Plus, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminPermissionsDialog } from "@/components/admin/AdminPermissionsDialog";
import { AdminFormDialog } from "@/components/admin/AdminFormDialog";
import { AdminsTable } from "@/components/admin/AdminsTable";
import { useToast } from "@/hooks/use-toast";

interface Admin {
  id: string;
  user_id: string | null;
  division_id: string;
  is_active: boolean;
  is_read_only?: boolean;
  cash_collection_enabled?: boolean;
  created_at: string;
  phone?: string;
  full_name?: string;
  access_all_divisions?: boolean;
  additional_division_ids?: string[];
  division?: { name: string };
}

interface Division {
  id: string;
  name: string;
}

export default function AdminsManagement() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<Admin | null>(null);
  const [permissionsAdmin, setPermissionsAdmin] = useState<Admin | null>(null);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAdmins = async () => {
    const { data, error } = await supabase
      .from("admins")
      .select("*, division:divisions(name)")
      .order("created_at", { ascending: false });

    if (!error) setAdmins(data || []);
  };

  const fetchDivisions = async () => {
    const { data, error } = await supabase
      .from("divisions")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (!error) setDivisions(data || []);
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([fetchAdmins(), fetchDivisions()]);
      setIsLoading(false);
    };
    load();
  }, []);

  const hashPassword = async (password: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const handleCreate = async (data: { fullName: string; phone: string; password: string; divisionId: string; isReadOnly: boolean; cashCollectionEnabled: boolean }) => {
    if (!data.phone || data.phone.length < 10) throw new Error("Please enter a valid phone number");
    if (!data.password || data.password.length < 6) throw new Error("Password must be at least 6 characters");

    const phone = data.phone.replace(/\s+/g, "").trim();
    const { data: existing } = await supabase.from("admins").select("id").eq("phone", phone).single();
    if (existing) throw new Error("An admin with this phone number already exists");

    const passwordHash = await hashPassword(data.password);
    const { error } = await supabase.from("admins").insert({
      division_id: data.divisionId,
      created_by: user?.id,
      phone,
      password_hash: passwordHash,
      full_name: data.fullName,
      is_read_only: data.isReadOnly,
      cash_collection_enabled: data.cashCollectionEnabled,
    } as any);

    if (error) throw error;
    toast({ title: "Admin created", description: "New admin has been created successfully." });
    fetchAdmins();
  };

  const handleEdit = async (data: { fullName: string; phone: string; password: string; divisionId: string; isReadOnly: boolean; cashCollectionEnabled: boolean }) => {
    if (!editingAdmin) return;
    const phone = data.phone.replace(/\s+/g, "").trim();

    if (phone !== editingAdmin.phone) {
      const { data: existing } = await supabase.from("admins").select("id").eq("phone", phone).neq("id", editingAdmin.id).single();
      if (existing) throw new Error("An admin with this phone number already exists");
    }

    const updateData: any = { full_name: data.fullName, phone, division_id: data.divisionId, is_read_only: data.isReadOnly, cash_collection_enabled: data.cashCollectionEnabled };
    if (data.password) {
      if (data.password.length < 6) throw new Error("Password must be at least 6 characters");
      updateData.password_hash = await hashPassword(data.password);
    }

    const { error } = await supabase.from("admins").update(updateData).eq("id", editingAdmin.id);
    if (error) throw error;
    toast({ title: "Admin updated", description: "Admin details have been updated successfully." });
    setEditingAdmin(null);
    fetchAdmins();
  };

  const handleDelete = async () => {
    if (!deletingAdmin) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("admins").delete().eq("id", deletingAdmin.id);
      if (error) throw error;
      toast({ title: "Admin deleted", description: "Admin has been permanently deleted." });
      setIsDeleteOpen(false);
      setDeletingAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete admin", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleStatus = async (adminId: string, currentStatus: boolean) => {
    const { error } = await supabase.from("admins").update({ is_active: !currentStatus }).eq("id", adminId);
    if (error) {
      toast({ title: "Error", description: "Failed to update admin status", variant: "destructive" });
      return;
    }
    toast({ title: "Status updated", description: `Admin has been ${!currentStatus ? "activated" : "deactivated"}.` });
    fetchAdmins();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button asChild variant="ghost" size="icon">
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Administration</h1>
            <p className="text-muted-foreground">
              Manage division administrators and their access permissions
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Admin
          </Button>
        </div>

        <AdminsTable
          admins={admins}
          divisions={divisions}
          onEdit={(admin) => {
            setEditingAdmin(admin);
            setIsEditOpen(true);
          }}
          onDelete={(admin) => {
            setDeletingAdmin(admin);
            setIsDeleteOpen(true);
          }}
          onToggleStatus={toggleStatus}
          onManagePermissions={(admin) => {
            setPermissionsAdmin(admin);
            setIsPermissionsOpen(true);
          }}
        />

        {/* Create Dialog */}
        <AdminFormDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          divisions={divisions}
          onSubmit={handleCreate}
          mode="create"
        />

        {/* Edit Dialog */}
        <AdminFormDialog
          open={isEditOpen}
          onOpenChange={(open) => {
            setIsEditOpen(open);
            if (!open) setEditingAdmin(null);
          }}
          divisions={divisions}
          onSubmit={handleEdit}
          mode="edit"
          initialData={editingAdmin ? {
            fullName: editingAdmin.full_name || "",
            phone: editingAdmin.phone || "",
            divisionId: editingAdmin.division_id,
            isReadOnly: editingAdmin.is_read_only ?? false,
            cashCollectionEnabled: editingAdmin.cash_collection_enabled ?? false,
          } : undefined}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Admin</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {deletingAdmin?.full_name || "this admin"}?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingAdmin(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Permissions Dialog */}
        <AdminPermissionsDialog
          open={isPermissionsOpen}
          onOpenChange={(open) => {
            setIsPermissionsOpen(open);
            if (!open) setPermissionsAdmin(null);
          }}
          admin={permissionsAdmin}
          divisions={divisions}
          onSaved={fetchAdmins}
        />
      </div>
    </Layout>
  );
}
