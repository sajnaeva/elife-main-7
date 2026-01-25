import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, Clock, User, Briefcase } from 'lucide-react';

interface JobApplication {
  id: string;
  job_id: string;
  applicant_id: string;
  message: string | null;
  creator_reply: string | null;
  replied_at: string | null;
  created_at: string;
  jobs?: {
    id: string;
    title: string;
    creator_id: string;
    status: string;
    approval_status: string;
  };
  applicant?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    mobile_number: string | null;
    email: string | null;
  };
}

const getSessionToken = () => {
  const stored = localStorage.getItem('admin_session');
  return stored ? JSON.parse(stored).session_token : null;
};

export default function AdminJobApplications() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['admin-job-applications'],
    queryFn: async () => {
      const sessionToken = getSessionToken();
      if (!sessionToken) throw new Error('No session');

      const { data, error } = await supabase.functions.invoke('manage-jobs', {
        body: { action: 'get_all_applications' },
        headers: { 'x-session-token': sessionToken },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data?.applications || [];
    },
  });

  const getReplyStatusBadge = (app: JobApplication) => {
    if (app.creator_reply) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Replied
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
        <Clock className="h-3 w-3 mr-1" />
        Pending Reply
      </Badge>
    );
  };

  const filteredApplications = applications.filter((app: JobApplication) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'replied') return !!app.creator_reply;
    if (statusFilter === 'pending') return !app.creator_reply;
    return true;
  });

  const columns: Column<JobApplication>[] = [
    {
      key: 'applicant',
      header: 'Applicant',
      render: (app) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={app.applicant?.avatar_url || ''} />
            <AvatarFallback>
              {app.applicant?.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">
              {app.applicant?.full_name || app.applicant?.username || 'Unknown'}
            </p>
            {app.applicant?.mobile_number && (
              <p className="text-xs text-muted-foreground">{app.applicant.mobile_number}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'job',
      header: 'Job',
      render: (app) => (
        <div>
          <p className="font-medium text-sm line-clamp-1">{app.jobs?.title || 'Unknown'}</p>
          <Badge variant="secondary" className="text-xs mt-1">
            {app.jobs?.approval_status || 'pending'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'message',
      header: 'Message',
      render: (app) => (
        <p className="text-sm text-muted-foreground line-clamp-2 max-w-xs">
          {app.message || <span className="italic">No message</span>}
        </p>
      ),
    },
    {
      key: 'reply_status',
      header: 'Reply Status',
      render: (app) => getReplyStatusBadge(app),
    },
    {
      key: 'creator_reply',
      header: 'Reply',
      render: (app) => (
        <p className="text-sm text-muted-foreground line-clamp-2 max-w-xs">
          {app.creator_reply || <span className="italic">-</span>}
        </p>
      ),
    },
    {
      key: 'created_at',
      header: 'Applied',
      render: (app) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (app) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/user/${app.applicant_id}`)}
          >
            <User className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/jobs/${app.job_id}`)}
          >
            <Briefcase className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const filterConfig = [
    {
      key: 'status',
      label: 'Reply Status',
      options: [
        { value: 'pending', label: 'Pending Reply' },
        { value: 'replied', label: 'Replied' },
      ],
    },
  ];

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'status') {
      setStatusFilter(value);
    }
  };

  return (
    <AdminLayout title="Job Applications" description="View all job applications and their status">
      <DataTable
        columns={columns}
        data={filteredApplications}
        isLoading={isLoading}
        filters={filterConfig}
        onFilterChange={handleFilterChange}
      />
    </AdminLayout>
  );
}
