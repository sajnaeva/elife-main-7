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
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Send, CheckCircle } from 'lucide-react';
import { Job } from '@/hooks/useJobs';

interface ApplyJobDialogProps {
  job: Job;
  onApplied?: () => void;
  hasApplied?: boolean;
}

export function ApplyJobDialog({ job, onApplied, hasApplied }: ApplyJobDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleApply = async () => {
    if (!user) {
      toast.error('Please login to apply');
      return;
    }

    setLoading(true);
    try {
      const sessionToken = localStorage.getItem('samrambhak_auth');
      const token = sessionToken ? JSON.parse(sessionToken).session_token : null;

      const { data, error } = await supabase.functions.invoke('manage-jobs', {
        body: { action: 'apply', job_id: job.id, message: message.trim() || null },
        headers: token ? { 'x-session-token': token } : {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Application submitted successfully!');
      setMessage('');
      setOpen(false);
      onApplied?.();
    } catch (error: any) {
      console.error('Error applying:', error);
      toast.error(error.message || 'Failed to apply');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Button variant="outline" size="sm" disabled>
        Login to Apply
      </Button>
    );
  }

  if (hasApplied) {
    return (
      <Button variant="outline" size="sm" disabled className="text-green-600">
        <CheckCircle className="h-4 w-4 mr-1" />
        Applied
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gradient-primary text-white">
          <Send className="h-4 w-4 mr-1" />
          Apply Now
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply for: {job.title}</DialogTitle>
          <DialogDescription>
            Your application will be sent to the job creator. Only they can see your details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Introduce yourself, explain why you're interested..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={loading} className="gradient-primary text-white">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Application
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
