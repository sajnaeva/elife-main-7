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
import { MoreHorizontal, Eye, EyeOff, Trash2, Star, Heart, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface Post {
  id: string;
  content: string | null;
  image_url: string | null;
  youtube_url: string | null;
  is_hidden: boolean | null;
  is_featured: boolean | null;
  created_at: string | null;
  user_id: string | null;
  business_id: string | null;
  author?: {
    full_name: string | null;
    username: string | null;
  };
  likes_count?: number;
  comments_count?: number;
}

export default function AdminPosts() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [actionDialog, setActionDialog] = useState<'hide' | 'delete' | null>(null);
  const [actionReason, setActionReason] = useState('');

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['admin-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_user_id_fkey(full_name, username)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get likes and comments counts
      const postsWithCounts = await Promise.all((data || []).map(async (post) => {
        const [likesResult, commentsResult] = await Promise.all([
          supabase.from('post_likes').select('id', { count: 'exact', head: true }).eq('post_id', post.id),
          supabase.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', post.id),
        ]);
        return {
          ...post,
          likes_count: likesResult.count || 0,
          comments_count: commentsResult.count || 0,
        };
      }));

      return postsWithCounts as Post[];
    },
  });

  const hideMutation = useMutation({
    mutationFn: async ({ postId, hide }: { postId: string; hide: boolean }) => {
      const response = await supabase.functions.invoke('admin-post-actions', {
        body: {
          action: hide ? 'hide' : 'unhide',
          post_id: postId,
          user_id: currentUser?.id,
          reason: actionReason,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: (_, { hide }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      toast.success(hide ? 'Post hidden successfully' : 'Post is now visible');
      setActionDialog(null);
      setSelectedPost(null);
      setActionReason('');
    },
    onError: (error) => {
      toast.error('Failed to update post: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await supabase.functions.invoke('admin-post-actions', {
        body: {
          action: 'delete',
          post_id: postId,
          user_id: currentUser?.id,
          reason: actionReason,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      toast.success('Post deleted successfully');
      setActionDialog(null);
      setSelectedPost(null);
      setActionReason('');
    },
    onError: (error) => {
      console.error('Delete mutation error:', error);
      toast.error('Failed to delete post: ' + error.message);
    },
  });

  const featureMutation = useMutation({
    mutationFn: async ({ postId, feature }: { postId: string; feature: boolean }) => {
      const { error } = await supabase
        .from('posts')
        .update({ is_featured: feature })
        .eq('id', postId);

      if (error) throw error;

      await supabase.from('admin_activity_logs').insert({
        admin_id: currentUser?.id,
        action: feature ? 'Featured post' : 'Unfeatured post',
        target_type: 'post',
        target_id: postId,
      });
    },
    onSuccess: (_, { feature }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      toast.success(feature ? 'Post featured' : 'Post unfeatured');
    },
    onError: (error) => {
      toast.error('Failed to update post: ' + error.message);
    },
  });

  const columns: Column<Post>[] = [
    {
      key: 'content',
      header: 'Content',
      render: (post) => (
        <div className="max-w-md">
          <p className="line-clamp-2 text-sm">
            {post.content || (post.image_url ? '[Image Post]' : post.youtube_url ? '[Video Post]' : '[Empty]')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            by {post.author?.full_name || 'Unknown'}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (post) => (
        <Badge variant="secondary">
          {post.image_url ? 'Image' : post.youtube_url ? 'Video' : 'Text'}
        </Badge>
      ),
    },
    {
      key: 'engagement',
      header: 'Engagement',
      render: (post) => (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {post.likes_count}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {post.comments_count}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (post) => (
        <div className="flex flex-wrap gap-1">
          {post.is_hidden ? (
            <Badge variant="destructive">Hidden</Badge>
          ) : (
            <Badge className="bg-green-500">Visible</Badge>
          )}
          {post.is_featured && (
            <Badge className="bg-yellow-500">
              <Star className="h-3 w-3 mr-1" />
              Featured
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Posted',
      render: (post) => (
        <span className="text-sm text-muted-foreground">
          {post.created_at 
            ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
            : 'Unknown'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (post) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => featureMutation.mutate({ 
                postId: post.id, 
                feature: !post.is_featured 
              })}
            >
              <Star className="h-4 w-4 mr-2" />
              {post.is_featured ? 'Unfeature' : 'Feature'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setSelectedPost(post);
                setActionDialog('hide');
              }}
            >
              {post.is_hidden ? (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show Post
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide Post
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSelectedPost(post);
                setActionDialog('delete');
              }}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Post
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <AdminLayout 
      title="Post Moderation" 
      description="Review and moderate user posts, manage featured content"
    >
      <DataTable
        columns={columns}
        data={posts}
        searchPlaceholder="Search posts..."
        searchKey="content"
        isLoading={isLoading}
        filters={[
          {
            key: 'type',
            label: 'Type',
            options: [
              { value: 'text', label: 'Text' },
              { value: 'image', label: 'Image' },
              { value: 'video', label: 'Video' },
            ],
          },
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'visible', label: 'Visible' },
              { value: 'hidden', label: 'Hidden' },
              { value: 'featured', label: 'Featured' },
            ],
          },
        ]}
      />

      {/* Hide/Show Dialog */}
      <Dialog open={actionDialog === 'hide'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPost?.is_hidden ? 'Show Post' : 'Hide Post'}
            </DialogTitle>
            <DialogDescription>
              {selectedPost?.is_hidden 
                ? 'This will make the post visible again.'
                : 'This will hide the post from public view.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Content Preview</Label>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {selectedPost?.content || '[No text content]'}
              </p>
            </div>
            {!selectedPost?.is_hidden && (
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for hiding..."
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
              variant={selectedPost?.is_hidden ? 'default' : 'destructive'}
              onClick={() => selectedPost && hideMutation.mutate({ 
                postId: selectedPost.id, 
                hide: !selectedPost.is_hidden 
              })}
              disabled={hideMutation.isPending}
            >
              {selectedPost?.is_hidden ? 'Show' : 'Hide'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={actionDialog === 'delete'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The post will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Content Preview</Label>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {selectedPost?.content || '[No text content]'}
              </p>
            </div>
            <div>
              <Label htmlFor="delete-reason">Reason for Deletion</Label>
              <Textarea
                id="delete-reason"
                placeholder="Enter reason for deletion..."
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
              onClick={() => selectedPost && deleteMutation.mutate(selectedPost.id)}
              disabled={deleteMutation.isPending || !actionReason.trim()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
