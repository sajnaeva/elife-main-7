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

export interface MyApplication {
  id: string;
  job_id: string;
  applicant_id: string;
  message: string | null;
  education_qualification: string | null;
  experience_details: string | null;
  creator_reply: string | null;
  replied_at: string | null;
  created_at: string;
  jobs: {
    id: string;
    title: string;
    description: string;
    location: string | null;
    status: 'open' | 'closed';
    approval_status: string | null;
    creator_id: string;
    created_at: string;
    profiles: {
      id: string;
      full_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  };
}

export function useMyApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyApplications = async () => {
    if (!user) {
      setApplications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const sessionToken = getSessionToken();
      const { data, error } = await supabase.functions.invoke('manage-jobs', {
        body: { action: 'my_applications' },
        headers: sessionToken ? { 'x-session-token': sessionToken } : {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setApplications(data?.applications || []);
    } catch (error) {
      console.error('Error fetching my applications:', error);
      toast.error('Failed to load your applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyApplications();
  }, [user]);

  return { applications, loading, refetch: fetchMyApplications };
}

export function useIsBusinessOwner() {
  const { user } = useAuth();
  const [isBusinessOwner, setIsBusinessOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkBusinessOwner = async () => {
    if (!user) {
      setIsBusinessOwner(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const sessionToken = getSessionToken();
      const { data, error } = await supabase.functions.invoke('manage-jobs', {
        body: { action: 'check_business_owner' },
        headers: sessionToken ? { 'x-session-token': sessionToken } : {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setIsBusinessOwner(data?.is_business_owner || false);
    } catch (error) {
      console.error('Error checking business owner:', error);
      setIsBusinessOwner(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkBusinessOwner();
  }, [user]);

  return { isBusinessOwner, loading };
}
