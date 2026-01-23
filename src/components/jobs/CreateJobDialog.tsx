import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Loader2 } from 'lucide-react';

interface CreateJobDialogProps {
  onJobCreated?: () => void;
  trigger?: React.ReactNode;
}

export function CreateJobDialog({ onJobCreated, trigger }: CreateJobDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [conditions, setConditions] = useState('');
  const [location, setLocation] = useState('');
  const [useTimeExpiry, setUseTimeExpiry] = useState(false);
  const [useCountExpiry, setUseCountExpiry] = useState(false);
  const [expiryDays, setExpiryDays] = useState('7');
  const [maxApplications, setMaxApplications] = useState('10');

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setConditions('');
    setLocation('');
    setUseTimeExpiry(false);
    setUseCountExpiry(false);
    setExpiryDays('7');
    setMaxApplications('10');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please login to create a job');
      return;
    }

    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    setLoading(true);
    try {
      const jobData: {
        creator_id: string;
        title: string;
        description: string;
        conditions: string | null;
        location: string | null;
        max_applications: number | null;
        expires_at: string | null;
        approval_status: string;
      } = {
        creator_id: user.id,
        title: title.trim(),
        description: description.trim(),
        conditions: conditions.trim() || null,
        location: location.trim() || null,
        max_applications: null,
        expires_at: null,
        approval_status: 'pending', // Require admin approval
      };

      if (useCountExpiry && maxApplications) {
        jobData.max_applications = parseInt(maxApplications);
      }

      if (useTimeExpiry && expiryDays) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
        jobData.expires_at = expiryDate.toISOString();
      }

      const { error } = await supabase.from('jobs').insert(jobData);

      if (error) throw error;

      toast.success('Job created! It will be visible after admin approval.');
      resetForm();
      setOpen(false);
      onJobCreated?.();
    } catch (error: any) {
      console.error('Error creating job:', error);
      toast.error(error.message || 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gradient-primary text-white">
            <Plus className="h-4 w-4 mr-2" />
            Post a Job
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post a New Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Looking for a Web Developer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the job requirements, responsibilities, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="conditions">Conditions / Requirements</Label>
            <Textarea
              id="conditions"
              placeholder="e.g., Must have 2+ years experience, Remote work available"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g., Malappuram, Kerala"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h4 className="font-medium text-sm">Expiry Settings</h4>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="time-expiry">Expire after time</Label>
                <p className="text-xs text-muted-foreground">Auto-close after specified days</p>
              </div>
              <Switch
                id="time-expiry"
                checked={useTimeExpiry}
                onCheckedChange={setUseTimeExpiry}
              />
            </div>
            
            {useTimeExpiry && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="count-expiry">Limit applications</Label>
                <p className="text-xs text-muted-foreground">Auto-close after max applications</p>
              </div>
              <Switch
                id="count-expiry"
                checked={useCountExpiry}
                onCheckedChange={setUseCountExpiry}
              />
            </div>
            
            {useCountExpiry && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={maxApplications}
                  onChange={(e) => setMaxApplications(e.target.value)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">max applications</span>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full gradient-primary text-white" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Post Job
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
