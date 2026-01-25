import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Job {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  conditions: string | null;
  location: string | null;
  status: 'open' | 'closed';
  approval_status: string | null;
  max_applications: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  application_count?: number;
  has_applied?: boolean;
}

export interface JobApplication {
  id: string;
  job_id: string;
  applicant_id: string;
  message: string | null;
  creator_reply: string | null;
  replied_at: string | null;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    mobile_number: string | null;
    email: string | null;
  };
}

// Helper to get session token
const getSessionToken = () => {
  const stored = localStorage.getItem('samrambhak_auth');
  return stored ? JSON.parse(stored).session_token : null;
};

export function useJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const sessionToken = getSessionToken();
      const { data, error } = await supabase.functions.invoke('manage-jobs', {
        body: { action: 'list' },
        headers: sessionToken ? { 'x-session-token': sessionToken } : {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setJobs(data?.jobs || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user]);

  return { jobs, loading, refetch: fetchJobs };
}

export function useJob(jobId: string) {
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJob = async () => {
    if (!jobId) return;
    
    setLoading(true);
    try {
      const sessionToken = getSessionToken();
      const { data, error } = await supabase.functions.invoke('manage-jobs', {
        body: { action: 'get', job_id: jobId },
        headers: sessionToken ? { 'x-session-token': sessionToken } : {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setJob(data?.job || null);
      setApplications(data?.applications || []);
    } catch (error) {
      console.error('Error fetching job:', error);
      toast.error('Failed to load job');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [jobId, user]);

  return { job, applications, loading, refetch: fetchJob };
}

export function useMyJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyJobs = async () => {
    if (!user) {
      setJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const sessionToken = getSessionToken();
      const { data, error } = await supabase.functions.invoke('manage-jobs', {
        body: { action: 'my_jobs' },
        headers: sessionToken ? { 'x-session-token': sessionToken } : {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setJobs(data?.jobs || []);
    } catch (error) {
      console.error('Error fetching my jobs:', error);
      toast.error('Failed to load your jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyJobs();
  }, [user]);

  return { jobs, loading, refetch: fetchMyJobs };
}
