import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MoreHorizontal, Ban, Eye, Users, Archive, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface Community {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  is_disabled: boolean | null;
  approval_status: string | null;
  created_at: string | null;
  created_by: string | null;
  creator?: {
    full_name: string | null;
    username: string | null;
  };
  member_count?: number;
}

export default function AdminCommunities() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [actionDialog, setActionDialog] = useState<'disable' | 'reject' | null>(null);
  const [actionReason, setActionReason] = useState('');

  const { data: communities = [], isLoading } = useQuery({
    queryKey: ['admin-communities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communities')
        .select(`
          *,
          creator:profiles!communities_created_by_fkey(full_name, username)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get member counts
      const communitiesWithCounts = await Promise.all((data || []).map(async (community) => {
        const { count } = await supabase
          .from('community_members')
          .select('id', { count: 'exact', head: true })
          .eq('community_id', community.id);
        return {
          ...community,
          member_count: count || 0,
        };
      }));

      return communitiesWithCounts as Community[];
    },
  });

  const disableMutation = useMutation({
    mutationFn: async ({ communityId, disable }: { communityId: string; disable: boolean }) => {
      const { error } = await supabase
        .from('communities')
        .update({ 
          is_disabled: disable,
          disabled_at: disable ? new Date().toISOString() : null,
          disabled_reason: disable ? actionReason : null,
        })
        .eq('id', communityId);

      if (error) throw error;

      await supabase.from('admin_activity_logs').insert({
        admin_id: currentUser?.id,
        action: disable ? 'Disabled community' : 'Enabled community',
        target_type: 'community',
        target_id: communityId,
        details: { reason: actionReason },
      });
    },
    onSuccess: (_, { disable }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-communities'] });
      toast.success(disable ? 'Community disabled successfully' : 'Community enabled');
      setActionDialog(null);
      setSelectedCommunity(null);
      setActionReason('');
    },
    onError: (error) => {
      toast.error('Failed to update community: ' + error.message);
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ communityId, status }: { communityId: string; status: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from('communities')
        .update({ 
          approval_status: status,
          disabled_reason: status === 'rejected' ? actionReason : null,
        })
        .eq('id', communityId);

      if (error) throw error;

      await supabase.from('admin_activity_logs').insert({
        admin_id: currentUser?.id,
        action: `${status.charAt(0).toUpperCase() + status.slice(1)} community`,
        target_type: 'community',
        target_id: communityId,
        details: { reason: status === 'rejected' ? actionReason : undefined },
      });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-communities'] });
      toast.success(`Community ${status} successfully`);
      setActionDialog(null);
      setSelectedCommunity(null);
      setActionReason('');
    },
    onError: (error) => {
      toast.error('Failed to update community: ' + error.message);
    },
  });

  const getStatusBadge = (community: Community) => {
    if (community.is_disabled) {
      return <Badge variant="destructive">Disabled</Badge>;
    }
    if (community.approval_status === 'pending') {
      return <Badge variant="outline" className="text-orange-600 border-orange-600">Pending</Badge>;
    }
    if (community.approval_status === 'rejected') {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    return <Badge className="bg-green-500">Active</Badge>;
  };

  const columns: Column<Community>[] = [
    {
      key: 'name',
      header: 'Community',
      render: (community) => (
        <div>
          <p className="font-medium">{community.name}</p>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {community.description || 'No description'}
          </p>
        </div>
      ),
    },
    {
      key: 'creator',
      header: 'Created By',
      render: (community) => (
        <span className="text-muted-foreground">
          {community.creator?.full_name || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'members',
      header: 'Members',
      render: (community) => (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{community.member_count}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (community) => getStatusBadge(community),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (community) => (
        <span className="text-sm text-muted-foreground">
          {community.created_at 
            ? formatDistanceToNow(new Date(community.created_at), { addSuffix: true })
            : 'Unknown'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (community) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => window.open(`/communities/${community.id}`, '_blank')}>
              <Eye className="h-4 w-4 mr-2" />
              View Community
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {community.approval_status === 'pending' && (
              <>
                <DropdownMenuItem
                  onClick={() => approvalMutation.mutate({ 
                    communityId: community.id, 
                    status: 'approved' 
                  })}
                  className="text-green-600"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedCommunity(community);
                    setActionDialog('reject');
                  }}
                  className="text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={() => {
                setSelectedCommunity(community);
                setActionDialog('disable');
              }}
              className={community.is_disabled ? 'text-green-600' : 'text-destructive'}
            >
              {community.is_disabled ? (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Enable Community
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Disable Community
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <AdminLayout 
      title="Community Management" 
      description="Manage communities, view member activity, and moderate content"
    >
      <DataTable
        columns={columns}
        data={communities}
        searchPlaceholder="Search communities..."
        searchKey="name"
        isLoading={isLoading}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'pending', label: 'Pending' },
              { value: 'disabled', label: 'Disabled' },
            ],
          },
        ]}
      />

      {/* Disable/Enable Dialog */}
      <Dialog open={actionDialog === 'disable'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCommunity?.is_disabled ? 'Enable Community' : 'Disable Community'}
            </DialogTitle>
            <DialogDescription>
              {selectedCommunity?.is_disabled 
                ? 'This will make the community accessible again.'
                : 'This will prevent members from accessing the community.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Community</Label>
              <p className="text-sm text-muted-foreground">{selectedCommunity?.name}</p>
            </div>
            {!selectedCommunity?.is_disabled && (
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for disabling..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={selectedCommunity?.is_disabled ? 'default' : 'destructive'}
              onClick={() => selectedCommunity && disableMutation.mutate({ 
                communityId: selectedCommunity.id, 
                disable: !selectedCommunity.is_disabled 
              })}
              disabled={disableMutation.isPending}
            >
              {selectedCommunity?.is_disabled ? 'Enable' : 'Disable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionDialog === 'reject'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Community</DialogTitle>
            <DialogDescription>
              This will reject the community application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Community</Label>
              <p className="text-sm text-muted-foreground">{selectedCommunity?.name}</p>
            </div>
            <div>
              <Label htmlFor="reject-reason">Reason for Rejection</Label>
              <Textarea
                id="reject-reason"
                placeholder="Enter reason for rejection..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedCommunity && approvalMutation.mutate({ 
                communityId: selectedCommunity.id, 
                status: 'rejected'
              })}
              disabled={approvalMutation.isPending || !actionReason.trim()}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
