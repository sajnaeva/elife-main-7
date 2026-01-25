import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useJobs, useMyJobs, useMyApplications, useIsBusinessOwner } from '@/hooks/useJobs';
import { JobCard } from '@/components/jobs/JobCard';
import { MyApplicationCard } from '@/components/jobs/MyApplicationCard';
import { CreateJobDialog } from '@/components/jobs/CreateJobDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, List, User, FileText, Store, Lock } from 'lucide-react';

export default function Jobs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const { jobs: allJobs, loading: loadingAll, refetch: refetchAll } = useJobs();
  const { jobs: myJobs, loading: loadingMy, refetch: refetchMy } = useMyJobs();
  const { applications, loading: loadingApplications, refetch: refetchApplications } = useMyApplications();
  const { isBusinessOwner, loading: loadingOwner } = useIsBusinessOwner();

  const handleRefetch = () => {
    refetchAll();
    refetchMy();
    refetchApplications();
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              Jobs
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Find opportunities or post your own job listings
            </p>
          </div>
          {user && isBusinessOwner && <CreateJobDialog onJobCreated={handleRefetch} />}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3 mb-6">
            <TabsTrigger value="all" className="gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">All Jobs</span>
              <span className="sm:hidden">All</span>
            </TabsTrigger>
            <TabsTrigger value="applications" className="gap-2" disabled={!user}>
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">My Applications</span>
              <span className="sm:hidden">Applied</span>
            </TabsTrigger>
            <TabsTrigger value="my" className="gap-2" disabled={!user || !isBusinessOwner}>
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">My Jobs</span>
              <span className="sm:hidden">Posted</span>
            </TabsTrigger>
          </TabsList>

          {/* All Jobs Tab */}
          <TabsContent value="all" className="space-y-4">
            {loadingAll ? (
              Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))
            ) : allJobs.length > 0 ? (
              allJobs.map((job) => (
                <JobCard key={job.id} job={job} onUpdate={handleRefetch} />
              ))
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No jobs posted yet</p>
                  {user && isBusinessOwner && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Be the first to post a job!
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Applications Tab */}
          <TabsContent value="applications" className="space-y-4">
            {!user ? (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Please login to see your applications</p>
                </CardContent>
              </Card>
            ) : loadingApplications ? (
              Array(2).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))
            ) : applications.length > 0 ? (
              applications.map((application) => (
                <MyApplicationCard key={application.id} application={application} />
              ))
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">You haven't applied to any jobs yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Browse available jobs and start applying!
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setActiveTab('all')}
                  >
                    Browse Jobs
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Jobs Tab (Business Owners Only) */}
          <TabsContent value="my" className="space-y-4">
            {!user ? (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Please login to see your jobs</p>
                </CardContent>
              </Card>
            ) : loadingOwner ? (
              <Skeleton className="h-48 w-full rounded-xl" />
            ) : !isBusinessOwner ? (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="font-medium text-foreground mb-2">Business Owners Only</p>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    To post jobs on this platform, you need to first create and get your business approved. 
                    This ensures quality job postings from verified businesses.
                  </p>
                  <Button 
                    className="mt-4 gap-2"
                    onClick={() => navigate('/my-businesses')}
                  >
                    <Store className="h-4 w-4" />
                    Create Your Business
                  </Button>
                </CardContent>
              </Card>
            ) : loadingMy ? (
              Array(2).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))
            ) : myJobs.length > 0 ? (
              myJobs.map((job) => (
                <JobCard key={job.id} job={job} onUpdate={handleRefetch} showApplications />
              ))
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">You haven't posted any jobs yet</p>
                  <div className="mt-4">
                    <CreateJobDialog onJobCreated={handleRefetch} />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
