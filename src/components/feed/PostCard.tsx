import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Flag } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { VerificationBadge } from '@/components/ui/verification-badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CommentSection } from './CommentSection';
import { YouTubeEmbed } from './YouTubeEmbed';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech or discrimination' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'violence', label: 'Violence or dangerous content' },
  { value: 'other', label: 'Other' },
];

interface PostCardProps {
  post: {
    id: string;
    content: string | null;
    image_url: string | null;
    youtube_url: string | null;
    instagram_url: string | null;
    created_at: string;
    user_id: string;
    profiles: {
      id: string;
      full_name: string | null;
      username: string | null;
      avatar_url: string | null;
      is_verified?: boolean;
    } | null;
    businesses: {
      id: string;
      name: string;
      logo_url: string | null;
    } | null;
    post_likes: { user_id: string }[];
    comments: { id: string }[];
  };
  onUpdate: () => void;
}

export function PostCard({ post, onUpdate }: PostCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showComments, setShowComments] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const isLiked = user ? post.post_likes.some(like => like.user_id === user.id) : false;
  const likeCount = post.post_likes.length;
  const commentCount = post.comments.length;

  const handleLike = async () => {
    if (!user) {
      toast({ title: 'Please sign in to like posts', variant: 'destructive' });
      return;
    }

    setIsLiking(true);
    try {
      const response = await supabase.functions.invoke('toggle-like', {
        body: {
          user_id: user.id,
          post_id: post.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to toggle like');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      onUpdate();
    } catch (error: any) {
      console.error('Error toggling like:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = async () => {
    const postUrl = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${post.profiles?.full_name || 'User'}`,
          text: post.content || 'Check out this post!',
          url: postUrl,
        });
      } else {
        await navigator.clipboard.writeText(postUrl);
        toast({ title: 'Link copied to clipboard!' });
      }
    } catch (error: any) {
      // User cancelled share or error - fallback to clipboard
      if (error.name !== 'AbortError') {
        await navigator.clipboard.writeText(postUrl);
        toast({ title: 'Link copied to clipboard!' });
      }
    }
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    toast({ title: isSaved ? 'Post removed from saved' : 'Post saved!' });
  };

  const handleDelete = async () => {
    if (!user || user.id !== post.user_id) {
      toast({ title: 'You can only delete your own posts', variant: 'destructive' });
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: 'Post deleted successfully' });
      onUpdate();
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast({ title: 'Failed to delete post', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReport = async () => {
    if (!user) {
      toast({ title: 'Please sign in to report posts', variant: 'destructive' });
      return;
    }

    if (!reportReason) {
      toast({ title: 'Please select a reason', variant: 'destructive' });
      return;
    }

    setIsReporting(true);
    try {
      const response = await supabase.functions.invoke('report-post', {
        body: {
          user_id: user.id,
          post_id: post.id,
          reason: reportReason,
          description: reportDescription || null,
        },
      });

      if (response.error) {
        const errorMessage = response.error.message || 'Failed to report post';
        // Check if this is a "already reported" message
        if (errorMessage.includes('already reported')) {
          toast({ title: 'Already reported', description: 'You have already reported this post.', variant: 'default' });
          setShowReportDialog(false);
          setReportReason('');
          setReportDescription('');
          return;
        }
        throw new Error(errorMessage);
      }

      if (response.data?.error) {
        // Check if this is a "already reported" message
        if (response.data.error.includes('already reported')) {
          toast({ title: 'Already reported', description: 'You have already reported this post.', variant: 'default' });
          setShowReportDialog(false);
          setReportReason('');
          setReportDescription('');
          return;
        }
        throw new Error(response.data.error);
      }

      toast({ title: 'Report submitted', description: 'Thank you for helping keep our community safe.' });
      setShowReportDialog(false);
      setReportReason('');
      setReportDescription('');
      onUpdate();
    } catch (error: any) {
      console.error('Error reporting post:', error);
      toast({ title: 'Failed to report', description: error.message || 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setIsReporting(false);
    }
  };

  const displayName = post.businesses?.name || post.profiles?.full_name || 'Anonymous';
  const displayAvatar = post.businesses?.logo_url || post.profiles?.avatar_url || '';
  const profileLink = post.businesses 
    ? `/business/${post.businesses.id}` 
    : `/user/${post.profiles?.id}`;

  return (
    <Card className="overflow-hidden card-hover border-0 shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Link to={profileLink} className="flex items-center gap-3">
            <Avatar className="h-11 w-11 ring-2 ring-primary/10">
              <AvatarImage src={displayAvatar} alt={displayName} />
              <AvatarFallback className="gradient-primary text-white">
                {displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-foreground hover:text-primary transition-colors flex items-center">
                {displayName}
                <VerificationBadge isVerified={!!post.profiles?.is_verified} size="sm" />
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={handleShare}>Share</DropdownMenuItem>
              <DropdownMenuItem onClick={handleSave}>
                {isSaved ? 'Unsave' : 'Save'}
              </DropdownMenuItem>
              {user && user.id !== post.user_id && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive gap-2" 
                    onClick={() => setShowReportDialog(true)}
                  >
                    <Flag className="h-4 w-4" />
                    Report
                  </DropdownMenuItem>
                </>
              )}
              {user?.id === post.user_id && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive" 
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-3">
        {/* Text Content */}
        {post.content && (
          <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
        )}

        {/* Image */}
        {post.image_url && (
          <div className="rounded-xl overflow-hidden">
            <img
              src={post.image_url}
              alt="Post image"
              className="w-full h-auto object-cover max-h-[500px]"
            />
          </div>
        )}

        {/* YouTube Embed */}
        {post.youtube_url && <YouTubeEmbed url={post.youtube_url} />}

        {/* Instagram Embed Placeholder */}
        {post.instagram_url && (
          <div className="rounded-xl bg-muted p-4 text-center">
            <p className="text-muted-foreground text-sm">
              Instagram content: {' '}
              <a 
                href={post.instagram_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View on Instagram
              </a>
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col pt-0 border-t">
        {/* Stats */}
        <div className="w-full flex items-center justify-between py-2 text-sm text-muted-foreground">
          <span>{likeCount} likes</span>
          <span>{commentCount} comments</span>
        </div>

        {/* Actions */}
        <div className="w-full flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-2', isLiked && 'text-red-500')}
            onClick={handleLike}
            disabled={isLiking}
          >
            <Heart className={cn('h-5 w-5', isLiked && 'fill-current')} />
            Like
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageCircle className="h-5 w-5" />
            Comment
          </Button>

          <Button variant="ghost" size="sm" className="gap-2" onClick={handleShare}>
            <Share2 className="h-5 w-5" />
            Share
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            className={cn('gap-2', isSaved && 'text-primary')}
            onClick={handleSave}
          >
            <Bookmark className={cn('h-5 w-5', isSaved && 'fill-current')} />
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="w-full pt-3 border-t mt-2">
            <CommentSection postId={post.id} onCommentAdded={onUpdate} />
          </div>
        )}
      </CardFooter>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report Post</DialogTitle>
            <DialogDescription>
              Help us understand what's wrong with this post. Your report is anonymous.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Why are you reporting this post?</Label>
              <RadioGroup value={reportReason} onValueChange={setReportReason}>
                {REPORT_REASONS.map((reason) => (
                  <div key={reason.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={reason.value} id={reason.value} />
                    <Label htmlFor={reason.value} className="font-normal cursor-pointer">
                      {reason.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Additional details (optional)</Label>
              <Textarea
                id="description"
                placeholder="Provide more context about why you're reporting this post..."
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReport} 
              disabled={!reportReason || isReporting}
              variant="destructive"
            >
              {isReporting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
