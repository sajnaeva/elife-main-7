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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MoreHorizontal, Eye, CheckCircle, XCircle, Users, Ban, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Job {
  id: string;
  title: string;
  description: string;
  location: string | null;
  status: 'open' | 'closed';
  approval_status: string | null;
  created_at: string | null;
  creator_id: string;
  creator?: {
    full_name: string | null;
    username: string | null;
  };
  application_count?: number;
}

const getSessionToken = () => {
  const stored = localStorage.getItem('admin_session');
  return stored ? JSON.parse(stored).session_token : null;
};

export default function AdminJobs() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [actionDialog, setActionDialog] = useState<'reject' | 'block' | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [actionReason, setActionReason] = useState('');

  const { data: jobs = [], isLoading, error } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: async () => {
      const sessionToken = getSessionToken();
      if (!sessionToken) throw new Error('No admin session');

      const { data, error } = await supabase.functions.invoke('admin-manage', {
        body: { action: 'list', entity_type: 'jobs' },
        headers: { 'x-session-token': sessionToken },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.data as Job[];
    },
    retry: 2,
    retryDelay: 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ jobId, updates }: { jobId: string; updates: Record<string, unknown> }) => {
      const sessionToken = getSessionToken();
      const { data, error } = await supabase.functions.invoke('admin-manage', {
        body: { 
          action: 'update',
          entity_type: 'jobs',
          entity_id: jobId,
          updates
        },
        headers: { 'x-session-token': sessionToken },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      toast.success('Job updated successfully');
      setActionDialog(null);
      setSelectedJob(null);
      setActionReason('');
    },
    onError: (error) => {
      toast.error('Failed to update job: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const sessionToken = getSessionToken();
      const { data, error } = await supabase.functions.invoke('admin-manage', {
        body: { 
          action: 'delete',
          entity_type: 'jobs',
          entity_id: jobId
        },
        headers: { 'x-session-token': sessionToken },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      toast.success('Job deleted successfully');
      setDeleteConfirmOpen(false);
      setSelectedJob(null);
    },
    onError: (error) => {
      toast.error('Failed to delete job: ' + error.message);
    },
  });

  const handleApprove = (job: Job) => {
    updateMutation.mutate({
      jobId: job.id,
      updates: { approval_status: 'approved' }
    });
  };

  const handleReject = () => {
    if (!selectedJob) return;
    updateMutation.mutate({
      jobId: selectedJob.id,
      updates: { approval_status: 'rejected' }
    });
  };

  const handleBlock = () => {
    if (!selectedJob) return;
    updateMutation.mutate({
      jobId: selectedJob.id,
      updates: { status: 'closed', approval_status: 'rejected' }
    });
  };

  const handleDelete = () => {
    if (!selectedJob) return;
    deleteMutation.mutate(selectedJob.id);
  };

  const getStatusBadge = (job: Job) => {
    if (job.approval_status === 'pending') {
      return <Badge variant="outline" className="text-orange-600 border-orange-600">Pending Approval</Badge>;
    }
    if (job.approval_status === 'rejected') {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    if (job.status === 'closed') {
      return <Badge variant="secondary">Closed</Badge>;
    }
    return <Badge className="bg-green-500">Open</Badge>;
  };

  const columns: Column<Job>[] = [
    {
      key: 'title',
      header: 'Job',
      render: (job) => (
        <div>
          <p className="font-medium">{job.title}</p>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {job.description}
          </p>
        </div>
      ),
    },
    {
      key: 'creator',
      header: 'Posted By',
      render: (job) => (
        <span className="text-muted-foreground">
          {job.creator?.full_name || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (job) => (
        <span className="text-muted-foreground">{job.location || 'Not specified'}</span>
      ),
    },
    {
      key: 'applications',
      header: 'Applications',
      render: (job) => (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{job.application_count || 0}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (job) => getStatusBadge(job),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (job) => (
        <span className="text-sm text-muted-foreground">
          {job.created_at 
            ? formatDistanceToNow(new Date(job.created_at), { addSuffix: true })
            : 'Unknown'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (job) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => window.open(`/jobs/${job.id}`, '_blank')}>
              <Eye className="h-4 w-4 mr-2" />
              View Job
            </DropdownMenuItem>
            {job.approval_status === 'pending' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleApprove(job)}
                  className="text-green-600"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedJob(job);
                    setActionDialog('reject');
                  }}
                  className="text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            {job.status === 'open' && job.approval_status === 'approved' && (
              <DropdownMenuItem
                onClick={() => {
                  setSelectedJob(job);
                  setActionDialog('block');
                }}
                className="text-orange-600"
              >
                <Ban className="h-4 w-4 mr-2" />
                Block Job
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => {
                setSelectedJob(job);
                setDeleteConfirmOpen(true);
              }}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <AdminLayout 
      title="Job Management" 
      description="Review, approve, block or delete job postings"
    >
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
          Error loading jobs: {error.message}
        </div>
      )}
      
      <DataTable
        columns={columns}
        data={jobs}
        searchPlaceholder="Search jobs..."
        searchKey="title"
        isLoading={isLoading}
        filters={[
          {
            key: 'approval_status',
            label: 'Status',
            options: [
              { value: 'approved', label: 'Approved' },
              { value: 'pending', label: 'Pending' },
              { value: 'rejected', label: 'Rejected' },
            ],
          },
        ]}
      />

      {/* Reject Dialog */}
      <Dialog open={actionDialog === 'reject'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Job Posting</DialogTitle>
            <DialogDescription>
              This will reject the job posting application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Job</Label>
              <p className="text-sm text-muted-foreground">{selectedJob?.title}</p>
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
              onClick={handleReject}
              disabled={updateMutation.isPending || !actionReason.trim()}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Dialog */}
      <Dialog open={actionDialog === 'block'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Job</DialogTitle>
            <DialogDescription>
              This will close the job and mark it as rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Job</Label>
              <p className="text-sm text-muted-foreground">{selectedJob?.title}</p>
            </div>
            <div>
              <Label htmlFor="block-reason">Reason for Blocking</Label>
              <Textarea
                id="block-reason"
                placeholder="Enter reason for blocking..."
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
              onClick={handleBlock}
              disabled={updateMutation.isPending || !actionReason.trim()}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Block Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedJob?.title}" and all its applications. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
