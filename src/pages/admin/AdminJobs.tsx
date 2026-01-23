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
import { MoreHorizontal, Eye, CheckCircle, XCircle, Briefcase, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

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

export default function AdminJobs() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [actionDialog, setActionDialog] = useState<'reject' | null>(null);
  const [actionReason, setActionReason] = useState('');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          creator:profiles!jobs_creator_id_fkey(full_name, username)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get application counts
      const jobsWithCounts = await Promise.all((data || []).map(async (job) => {
        const { count } = await supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', job.id);
        return {
          ...job,
          application_count: count || 0,
        };
      }));

      return jobsWithCounts as Job[];
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from('jobs')
        .update({ 
          approval_status: status,
        })
        .eq('id', jobId);

      if (error) throw error;

      await supabase.from('admin_activity_logs').insert({
        admin_id: currentUser?.id,
        action: `${status.charAt(0).toUpperCase() + status.slice(1)} job`,
        target_type: 'job',
        target_id: jobId,
        details: { reason: status === 'rejected' ? actionReason : undefined },
      });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      toast.success(`Job ${status} successfully`);
      setActionDialog(null);
      setSelectedJob(null);
      setActionReason('');
    },
    onError: (error) => {
      toast.error('Failed to update job: ' + error.message);
    },
  });

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
          <span>{job.application_count}</span>
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
                  onClick={() => approvalMutation.mutate({ 
                    jobId: job.id, 
                    status: 'approved' 
                  })}
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
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <AdminLayout 
      title="Job Management" 
      description="Review and approve job postings, manage applications"
    >
      <DataTable
        columns={columns}
        data={jobs}
        searchPlaceholder="Search jobs..."
        searchKey="title"
        isLoading={isLoading}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'open', label: 'Open' },
              { value: 'pending', label: 'Pending' },
              { value: 'closed', label: 'Closed' },
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
              onClick={() => selectedJob && approvalMutation.mutate({ 
                jobId: selectedJob.id, 
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