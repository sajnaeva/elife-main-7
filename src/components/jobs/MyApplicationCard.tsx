import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MapPin,
  Clock,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { MyApplication } from '@/hooks/useJobs';

interface MyApplicationCardProps {
  application: MyApplication;
}

export function MyApplicationCard({ application }: MyApplicationCardProps) {
  const navigate = useNavigate();
  const job = application.jobs;

  const getStatusBadge = () => {
    if (!application.creator_reply) {
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-600">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Pending Review
        </Badge>
      );
    }

    // Analyze reply for status
    const reply = application.creator_reply.toLowerCase();
    if (reply.includes('shortlisted') || reply.includes('congratulations')) {
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Shortlisted
        </Badge>
      );
    } else if (reply.includes('unfortunately') || reply.includes('not selected')) {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Not Selected
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary">
          <AlertCircle className="h-3 w-3 mr-1" />
          Response Received
        </Badge>
      );
    }
  };

  const getReplyStyleClass = () => {
    if (!application.creator_reply) return '';
    const reply = application.creator_reply.toLowerCase();
    if (reply.includes('shortlisted') || reply.includes('congratulations')) {
      return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
    } else if (reply.includes('unfortunately') || reply.includes('not selected')) {
      return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
    }
    return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
  };

  return (
    <Card className="border-0 shadow-soft transition-all hover:shadow-md">
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
                by {job.profiles?.full_name || job.profiles?.username || 'Anonymous'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {getStatusBadge()}
            <Badge variant={job.status === 'open' ? 'default' : 'secondary'} className={job.status === 'open' ? 'bg-green-500' : ''}>
              {job.status === 'open' ? 'Open' : 'Closed'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {job.description}
        </p>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {job.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {job.location}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Applied {formatDistanceToNow(new Date(application.created_at), { addSuffix: true })}
          </div>
        </div>

        {/* Creator's Response */}
        {application.creator_reply && (
          <div className={`p-3 rounded-lg border ${getReplyStyleClass()}`}>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Response from Employer</span>
              {application.replied_at && (
                <span className="text-xs text-muted-foreground">
                  • {formatDistanceToNow(new Date(application.replied_at), { addSuffix: true })}
                </span>
              )}
            </div>
            <p className="text-sm">{application.creator_reply}</p>
          </div>
        )}

        {/* No response yet */}
        {!application.creator_reply && (
          <div className="p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Waiting for employer's response...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
