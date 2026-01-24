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

export function useJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      // Auto-close expired jobs first
      if (user) {
        await supabase
          .from('jobs')
          .update({ status: 'closed' })
          .eq('status', 'open')
          .lt('expires_at', new Date().toISOString())
          .not('expires_at', 'is', null);
      }

      const { data: jobsData, error } = await supabase
        .from('jobs')
        .select(`
          *,
          profiles:creator_id (id, full_name, username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get application counts and user's application status
      const jobsWithCounts = await Promise.all(
        (jobsData || []).map(async (job) => {
          const { count } = await supabase
            .from('job_applications')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', job.id);

          let hasApplied = false;
          if (user) {
            const { data: application } = await supabase
              .from('job_applications')
              .select('id')
              .eq('job_id', job.id)
              .eq('applicant_id', user.id)
              .maybeSingle();
            hasApplied = !!application;
          }

          return {
            ...job,
            application_count: count || 0,
            has_applied: hasApplied,
          };
        })
      );

      setJobs(jobsWithCounts);
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
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          profiles:creator_id (id, full_name, username, avatar_url)
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;

      // Get application count
      const { count } = await supabase
        .from('job_applications')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId);

      // Check if user has applied
      let hasApplied = false;
      if (user) {
        const { data: application } = await supabase
          .from('job_applications')
          .select('id')
          .eq('job_id', jobId)
          .eq('applicant_id', user.id)
          .maybeSingle();
        hasApplied = !!application;
      }

      setJob({
        ...data,
        application_count: count || 0,
        has_applied: hasApplied,
      });

      // Fetch applications if user is creator
      if (user && data.creator_id === user.id) {
        const { data: apps, error: appsError } = await supabase
          .from('job_applications')
          .select(`
            *,
            profiles:applicant_id (id, full_name, username, avatar_url, mobile_number, email)
          `)
          .eq('job_id', jobId)
          .order('created_at', { ascending: false });

        if (!appsError) {
          setApplications(apps || []);
        }
      }
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
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          profiles:creator_id (id, full_name, username, avatar_url)
        `)
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get application counts
      const jobsWithCounts = await Promise.all(
        (data || []).map(async (job) => {
          const { count } = await supabase
            .from('job_applications')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', job.id);

          return {
            ...job,
            application_count: count || 0,
          };
        })
      );

      setJobs(jobsWithCounts);
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
