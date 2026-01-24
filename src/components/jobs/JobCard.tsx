import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Briefcase,
  MapPin,
  Clock,
  Users,
  Share2,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Job } from '@/hooks/useJobs';
import { ApplyJobDialog } from './ApplyJobDialog';

interface JobCardProps {
  job: Job;
  onUpdate?: () => void;
  showApplications?: boolean;
}

export function JobCard({ job, onUpdate, showApplications }: JobCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sharing, setSharing] = useState(false);

  const isExpired = job.status === 'closed' || 
    (job.expires_at && new Date(job.expires_at) < new Date()) ||
    (job.max_applications && job.application_count && job.application_count >= job.max_applications);

  const isCreator = user?.id === job.creator_id;

  const handleShare = async () => {
    setSharing(true);
    try {
      const url = `${window.location.origin}/jobs/${job.id}`;
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
    } finally {
      setSharing(false);
    }
  };

  const handleCloseJob = async () => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'closed' })
        .eq('id', job.id);

      if (error) throw error;
      toast.success('Job closed successfully');
      onUpdate?.();
    } catch (error) {
      toast.error('Failed to close job');
    }
  };

  const getExpiryText = () => {
    if (job.expires_at) {
      const expiryDate = new Date(job.expires_at);
      if (expiryDate < new Date()) {
        return 'Expired';
      }
      return `Expires ${formatDistanceToNow(expiryDate, { addSuffix: true })}`;
    }
    if (job.max_applications) {
      return `${job.application_count || 0}/${job.max_applications} applications`;
    }
    return null;
  };

  return (
    <Card className={`border-0 shadow-soft transition-all hover:shadow-md ${isExpired ? 'opacity-70' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={job.profiles?.avatar_url || ''} />
              <AvatarFallback>
                {job.profiles?.full_name?.charAt(0) || job.profiles?.username?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 
                className="font-semibold text-foreground truncate cursor-pointer hover:text-primary"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                {job.title}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {job.profiles?.full_name || job.profiles?.username || 'Anonymous'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Show pending/rejected badge for creator */}
            {isCreator && job.approval_status === 'pending' && (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                <Clock className="h-3 w-3 mr-1" />
                Pending Approval
              </Badge>
            )}
            {isCreator && job.approval_status === 'rejected' && (
              <Badge variant="destructive">
                Rejected
              </Badge>
            )}
            {/* Status badge */}
            <Badge variant={isExpired ? 'secondary' : 'default'} className={isExpired ? '' : 'bg-green-500'}>
              {isExpired ? (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Closed
                </>
              ) : (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Open
                </>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {job.description}
        </p>

        {job.conditions && (
          <div className="text-sm">
            <span className="font-medium">Requirements:</span>
            <p className="text-muted-foreground line-clamp-2">{job.conditions}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {job.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {job.location}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
          </div>
          {getExpiryText() && (
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {getExpiryText()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          {!isExpired && !isCreator && user && (
            <ApplyJobDialog 
              job={job} 
              onApplied={onUpdate}
              hasApplied={job.has_applied}
            />
          )}
          
          {isCreator && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                <Users className="h-4 w-4 mr-1" />
                View Applications ({job.application_count || 0})
              </Button>
              {!isExpired && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseJob}
                  className="text-destructive hover:text-destructive"
                >
                  Close Job
                </Button>
              )}
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            disabled={sharing}
            className="ml-auto"
          >
            {sharing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
