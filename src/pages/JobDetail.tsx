import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useJob } from '@/hooks/useJobs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Clock,
  Users,
  Share2,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  User,
  MessageSquare,
  Reply,
  Loader2,
  CheckSquare,
} from 'lucide-react';
import { ApplyJobDialog } from '@/components/jobs/ApplyJobDialog';

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { job, applications, loading, refetch } = useJob(id || '');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [selectedApplications, setSelectedApplications] = useState<string[]>([]);
  const [bulkReplying, setBulkReplying] = useState(false);

  // Filter applications that haven't been replied to
  const unrepliedApplications = useMemo(() => 
    applications.filter(app => !app.creator_reply), 
    [applications]
  );

  const handleReply = async (applicationId: string, replyType: string) => {
    setReplyingTo(applicationId);
    try {
      const sessionToken = localStorage.getItem('samrambhak_auth');
      const token = sessionToken ? JSON.parse(sessionToken).session_token : null;

      const { data, error } = await supabase.functions.invoke('manage-jobs', {
        body: { action: 'reply', application_id: applicationId, reply_type: replyType },
        headers: token ? { 'x-session-token': token } : {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Reply sent to applicant!');
      refetch();
    } catch (error: any) {
      console.error('Error replying:', error);
      toast.error(error.message || 'Failed to send reply');
    } finally {
      setReplyingTo(null);
    }
  };

  const handleBulkReply = async (replyType: string) => {
    if (selectedApplications.length === 0) {
      toast.error('Please select at least one application');
      return;
    }

    setBulkReplying(true);
    try {
      const sessionToken = localStorage.getItem('samrambhak_auth');
      const token = sessionToken ? JSON.parse(sessionToken).session_token : null;

      const { data, error } = await supabase.functions.invoke('manage-jobs', {
        body: { 
          action: 'bulk_reply', 
          job_id: id,
          application_ids: selectedApplications, 
          reply_type: replyType 
        },
        headers: token ? { 'x-session-token': token } : {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data.message || 'Replies sent!');
      setSelectedApplications([]);
      refetch();
    } catch (error: any) {
      console.error('Error bulk replying:', error);
      toast.error(error.message || 'Failed to send replies');
    } finally {
      setBulkReplying(false);
    }
  };

  const toggleSelectApplication = (appId: string) => {
    setSelectedApplications(prev => 
      prev.includes(appId) 
        ? prev.filter(id => id !== appId)
        : [...prev, appId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedApplications.length === unrepliedApplications.length) {
      setSelectedApplications([]);
    } else {
      setSelectedApplications(unrepliedApplications.map(app => app.id));
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  if (!job) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <Briefcase className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Job Not Found</h1>
          <p className="text-muted-foreground mb-4">This job may have been removed or doesn't exist.</p>
          <Button onClick={() => navigate('/jobs')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isExpired = job.status === 'closed' || 
    (job.expires_at && new Date(job.expires_at) < new Date()) ||
    (job.max_applications && job.application_count && job.application_count >= job.max_applications);

  const isCreator = user?.id === job.creator_id;

  const handleShare = async () => {
    try {
      const url = window.location.href;
      if (navigator.share) {
        await navigator.share({
          title: job.title,
          text: job.description.slice(0, 100) + '...',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast.error('Failed to share');
      }
    }
  };

  const handleCloseJob = async () => {
    try {
      const sessionToken = localStorage.getItem('samrambhak_auth');
      const token = sessionToken ? JSON.parse(sessionToken).session_token : null;

      const { data, error } = await supabase.functions.invoke('manage-jobs', {
        body: { action: 'update', job_id: job.id, status: 'closed' },
        headers: token ? { 'x-session-token': token } : {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Job closed successfully');
      refetch();
    } catch (error: any) {
      console.error('Error closing job:', error);
      toast.error(error.message || 'Failed to close job');
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/jobs')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Jobs
        </Button>

        <Card className="border-0 shadow-soft mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={job.profiles?.avatar_url || ''} />
                  <AvatarFallback>
                    {job.profiles?.full_name?.charAt(0) || job.profiles?.username?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm text-muted-foreground">Posted by</p>
                  <p className="font-medium">
                    {job.profiles?.full_name || job.profiles?.username || 'Anonymous'}
                  </p>
                </div>
              </div>
              <Badge 
                variant={isExpired ? 'secondary' : 'default'} 
                className={`text-sm ${isExpired ? '' : 'bg-green-500'}`}
              >
                {isExpired ? (
                  <>
                    <XCircle className="h-4 w-4 mr-1" />
                    Offer Ended
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Open
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-2">{job.title}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {job.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {job.location}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {job.application_count || 0} applications
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
            </div>

            {job.conditions && (
              <div>
                <h3 className="font-semibold mb-2">Requirements / Conditions</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{job.conditions}</p>
              </div>
            )}

            {(job.expires_at || job.max_applications) && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Expiry Info</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  {job.expires_at && (
                    <p>
                      {new Date(job.expires_at) < new Date() 
                        ? `Expired on ${format(new Date(job.expires_at), 'PPP')}`
                        : `Expires on ${format(new Date(job.expires_at), 'PPP')}`
                      }
                    </p>
                  )}
                  {job.max_applications && (
                    <p>
                      Limited to {job.max_applications} applications 
                      ({job.application_count || 0} received)
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-4 border-t">
              {!isExpired && !isCreator && user && (
                <ApplyJobDialog job={job} onApplied={refetch} hasApplied={job.has_applied} />
              )}
              
              {isCreator && !isExpired && (
                <Button
                  variant="outline"
                  onClick={handleCloseJob}
                  className="text-destructive hover:text-destructive"
                >
                  Close Job
                </Button>
              )}

              <Button variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Applications section - only visible to creator */}
        {isCreator && (
          <Card className="border-0 shadow-soft">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Applications ({applications.length})
                </CardTitle>
                
                {/* Bulk Reply Actions */}
                {unrepliedApplications.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleSelectAll}
                      className="gap-2"
                    >
                      <CheckSquare className="h-4 w-4" />
                      {selectedApplications.length === unrepliedApplications.length ? 'Deselect All' : 'Select All Unreplied'}
                    </Button>
                    
                    {selectedApplications.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            size="sm"
                            disabled={bulkReplying}
                            className="gap-2"
                          >
                            {bulkReplying ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Reply className="h-4 w-4" />
                            )}
                            Reply to {selectedApplications.length} selected
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleBulkReply('contact_soon')}>
                            We will contact you soon
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleBulkReply('shortlisted')}>
                            You are shortlisted
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleBulkReply('not_selected')}>
                            Not selected
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No applications yet
                </p>
              ) : (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <div key={app.id} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        {/* Checkbox for bulk selection - only for unreplied */}
                        {!app.creator_reply && (
                          <Checkbox
                            checked={selectedApplications.includes(app.id)}
                            onCheckedChange={() => toggleSelectApplication(app.id)}
                            className="mt-1"
                          />
                        )}
                        <Avatar>
                          <AvatarImage src={app.profiles?.avatar_url || ''} />
                          <AvatarFallback>
                            {app.profiles?.full_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">
                              {app.profiles?.full_name || app.profiles?.username || 'Anonymous'}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              Applied {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          
                          {app.message && (
                            <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                              <p className="text-sm flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                                {app.message}
                              </p>
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap gap-3 text-sm">
                            {app.profiles?.mobile_number && (
                              <a 
                                href={`tel:${app.profiles.mobile_number}`}
                                className="flex items-center gap-1 text-primary hover:underline"
                              >
                                <Phone className="h-4 w-4" />
                                {app.profiles.mobile_number}
                              </a>
                            )}
                            {app.profiles?.email && (
                              <a 
                                href={`mailto:${app.profiles.email}`}
                                className="flex items-center gap-1 text-primary hover:underline"
                              >
                                <Mail className="h-4 w-4" />
                                {app.profiles.email}
                              </a>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/user/${app.applicant_id}`)}
                            >
                              <User className="h-4 w-4 mr-1" />
                              View Profile
                            </Button>
                          </div>

                          {/* Reply Section */}
                          {app.creator_reply ? (
                            <div className="mt-3 p-3 bg-muted/30 border rounded-lg">
                              <p className="text-sm font-medium text-primary flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" />
                                Reply Sent
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {app.creator_reply}
                              </p>
                              {app.replied_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Sent {formatDistanceToNow(new Date(app.replied_at), { addSuffix: true })}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="mt-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    disabled={replyingTo === app.id}
                                  >
                                    {replyingTo === app.id ? (
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : (
                                      <Reply className="h-4 w-4 mr-1" />
                                    )}
                                    Send Reply
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem onClick={() => handleReply(app.id, 'contact_soon')}>
                                    We will contact you soon
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleReply(app.id, 'shortlisted')}>
                                    You are shortlisted
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleReply(app.id, 'not_selected')}>
                                    Not selected
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
