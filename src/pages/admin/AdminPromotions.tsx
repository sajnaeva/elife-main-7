import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Image, Video, Gift, Layout, FileImage, ExternalLink, GripVertical, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface PromotionalContent {
  id: string;
  title: string;
  description: string | null;
  content_type: 'banner' | 'poster' | 'image' | 'video' | 'offer';
  image_url: string | null;
  video_url: string | null;
  link_url: string | null;
  link_text: string | null;
  is_active: boolean;
  display_order: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

const contentTypeIcons = {
  banner: Layout,
  poster: FileImage,
  image: Image,
  video: Video,
  offer: Gift,
};

const contentTypeLabels = {
  banner: 'Banner',
  poster: 'Poster',
  image: 'Image',
  video: 'Video',
  offer: 'Offer',
};

type ContentType = 'banner' | 'poster' | 'image' | 'video' | 'offer';

export default function AdminPromotions() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PromotionalContent | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_type: 'banner' as ContentType,
    image_url: '',
    video_url: '',
    link_url: '',
    link_text: '',
    is_active: true,
    display_order: 0,
    start_date: '',
    end_date: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: promotions, isLoading } = useQuery({
    queryKey: ['admin-promotions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotional_content')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PromotionalContent[];
    },
  });

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `promotions/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('businesses')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('businesses').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      let imageUrl = data.image_url;
      
      if (imageFile) {
        setUploading(true);
        imageUrl = await uploadImage(imageFile);
        setUploading(false);
      }

      const { error } = await supabase.from('promotional_content').insert({
        title: data.title,
        description: data.description || null,
        content_type: data.content_type,
        image_url: imageUrl || null,
        video_url: data.video_url || null,
        link_url: data.link_url || null,
        link_text: data.link_text || null,
        is_active: data.is_active,
        display_order: data.display_order,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Promotional content created');
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to create: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      let imageUrl = data.image_url;
      
      if (imageFile) {
        setUploading(true);
        imageUrl = await uploadImage(imageFile);
        setUploading(false);
      }

      const { error } = await supabase.from('promotional_content').update({
        title: data.title,
        description: data.description || null,
        content_type: data.content_type,
        image_url: imageUrl || null,
        video_url: data.video_url || null,
        link_url: data.link_url || null,
        link_text: data.link_text || null,
        is_active: data.is_active,
        display_order: data.display_order,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      }).eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Promotional content updated');
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('promotional_content').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Promotional content deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
    },
    onError: (error) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('promotional_content').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      content_type: 'banner',
      image_url: '',
      video_url: '',
      link_url: '',
      link_text: '',
      is_active: true,
      display_order: 0,
      start_date: '',
      end_date: '',
    });
    setEditingItem(null);
    setImageFile(null);
  };

  const handleEdit = (item: PromotionalContent) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      content_type: item.content_type,
      image_url: item.image_url || '',
      video_url: item.video_url || '',
      link_url: item.link_url || '',
      link_text: item.link_text || '',
      is_active: item.is_active,
      display_order: item.display_order,
      start_date: item.start_date ? item.start_date.split('T')[0] : '',
      end_date: item.end_date ? item.end_date.split('T')[0] : '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getStatusBadge = (item: PromotionalContent) => {
    if (!item.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    const now = new Date();
    const startDate = item.start_date ? new Date(item.start_date) : null;
    const endDate = item.end_date ? new Date(item.end_date) : null;
    
    if (startDate && startDate > now) {
      return <Badge variant="outline" className="border-amber-500 text-amber-600">Scheduled</Badge>;
    }
    if (endDate && endDate < now) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    return <Badge className="bg-green-500">Active</Badge>;
  };

  return (
    <AdminLayout 
      title="Promotional Content" 
      description="Manage banners, posters, and promotional content for all users"
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          {Object.entries(contentTypeLabels).map(([type, label]) => {
            const count = promotions?.filter(p => p.content_type === type).length || 0;
            return (
              <Badge key={type} variant="outline" className="gap-1">
                {label}: {count}
              </Badge>
            );
          })}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Content
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit' : 'Add'} Promotional Content</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content_type">Content Type *</Label>
                  <Select 
                    value={formData.content_type} 
                    onValueChange={(value: ContentType) => setFormData({ ...formData, content_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="banner">Banner</SelectItem>
                      <SelectItem value="poster">Poster</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="offer">Offer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Image</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Or enter image URL below</p>
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                />
                {(formData.image_url || imageFile) && (
                  <div className="mt-2 relative w-full h-32 rounded-lg overflow-hidden bg-muted">
                    <img 
                      src={imageFile ? URL.createObjectURL(imageFile) : formData.image_url} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {(formData.content_type === 'video') && (
                <div className="space-y-2">
                  <Label htmlFor="video_url">Video URL (YouTube)</Label>
                  <Input
                    id="video_url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={formData.video_url}
                    onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="link_url">Link URL</Label>
                  <Input
                    id="link_url"
                    placeholder="https://..."
                    value={formData.link_url}
                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link_text">Link Text</Label>
                  <Input
                    id="link_text"
                    placeholder="Learn More"
                    value={formData.link_text}
                    onChange={(e) => setFormData({ ...formData, link_text: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending || uploading}
                >
                  {uploading ? 'Uploading...' : (editingItem ? 'Update' : 'Create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-48 bg-muted" />
            </Card>
          ))}
        </div>
      ) : promotions?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layout className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No promotional content yet</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Add Content" to create your first banner or poster</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {promotions?.map((item) => {
            const Icon = contentTypeIcons[item.content_type];
            return (
              <Card key={item.id} className={!item.is_active ? 'opacity-60' : ''}>
                {item.image_url && (
                  <div className="relative h-40 overflow-hidden rounded-t-lg">
                    <img 
                      src={item.image_url} 
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2">
                      <Badge variant="secondary" className="gap-1">
                        <Icon className="h-3 w-3" />
                        {contentTypeLabels[item.content_type]}
                      </Badge>
                    </div>
                    <div className="absolute top-2 right-2">
                      {getStatusBadge(item)}
                    </div>
                  </div>
                )}
                <CardHeader className={item.image_url ? 'pt-3' : ''}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {!item.image_url && <Icon className="h-5 w-5 text-muted-foreground" />}
                      <CardTitle className="text-base line-clamp-1">{item.title}</CardTitle>
                    </div>
                    {!item.image_url && getStatusBadge(item)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <GripVertical className="h-3 w-3" />
                    Order: {item.display_order}
                    {item.link_url && (
                      <>
                        <span className="mx-1">•</span>
                        <ExternalLink className="h-3 w-3" />
                        Has link
                      </>
                    )}
                  </div>
                  
                  {(item.start_date || item.end_date) && (
                    <p className="text-xs text-muted-foreground">
                      {item.start_date && `From: ${format(new Date(item.start_date), 'MMM d, yyyy')}`}
                      {item.start_date && item.end_date && ' - '}
                      {item.end_date && `To: ${format(new Date(item.end_date), 'MMM d, yyyy')}`}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => toggleActiveMutation.mutate({ id: item.id, is_active: !item.is_active })}
                    >
                      {item.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('Delete this promotional content?')) {
                          deleteMutation.mutate(item.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
