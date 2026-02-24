import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminInfo {
  id: string;
  user_id: string;
  full_name: string | null;
  is_active: boolean;
  phone: string | null;
  created_at: string;
  division: { name: string } | null;
}

interface DivisionInfo {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  programCount: number;
  memberCount: number;
}

interface RecentActivity {
  id: string;
  type: "registration" | "program" | "admin";
  description: string;
  timestamp: string;
}

interface SuperAdminStats {
  totalAdmins: number;
  activeAdmins: number;
  totalDivisions: number;
  activeDivisions: number;
  totalPrograms: number;
  activePrograms: number;
  totalRegistrations: number;
  totalMembers: number;
  admins: AdminInfo[];
  divisions: DivisionInfo[];
  recentActivity: RecentActivity[];
  isLoading: boolean;
  error: string | null;
}

export function useSuperAdminStats(): SuperAdminStats & {
  toggleAdminStatus: (adminId: string, currentStatus: boolean) => Promise<void>;
  refetch: () => void;
} {
  const [stats, setStats] = useState<SuperAdminStats>({
    totalAdmins: 0,
    activeAdmins: 0,
    totalDivisions: 0,
    activeDivisions: 0,
    totalPrograms: 0,
    activePrograms: 0,
    totalRegistrations: 0,
    totalMembers: 0,
    admins: [],
    divisions: [],
    recentActivity: [],
    isLoading: true,
    error: null,
  });

  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch admins
        const { data: admins, error: adminsError } = await supabase
          .from("admins")
          .select(`
            id,
            user_id,
            full_name,
            is_active,
            phone,
            created_at,
            division:divisions(name)
          `)
          .order("created_at", { ascending: false });
        
        if (adminsError) throw adminsError;

        const adminData: AdminInfo[] = (admins || []).map((admin) => ({
          ...admin,
          division: admin.division as { name: string } | null,
        }));

        // Fetch divisions with counts
        const { data: divisions, error: divisionsError } = await supabase
          .from("divisions")
          .select("id, name, description, is_active")
          .order("name");
        
        if (divisionsError) throw divisionsError;

        const divisionData: DivisionInfo[] = [];
        for (const div of divisions || []) {
          const { count: programCount } = await supabase
            .from("programs")
            .select("*", { count: "exact", head: true })
            .eq("division_id", div.id);
          
          const { count: memberCount } = await supabase
            .from("members")
            .select("*", { count: "exact", head: true })
            .eq("division_id", div.id);
          
          divisionData.push({
            ...div,
            programCount: programCount || 0,
            memberCount: memberCount || 0,
          });
        }

        // Fetch programs
        const { data: programs, error: programsError } = await supabase
          .from("programs")
          .select("id, is_active, name, created_at")
          .order("created_at", { ascending: false });
        
        if (programsError) throw programsError;

        // Fetch registrations
        const { count: registrationCount, error: regError } = await supabase
          .from("program_registrations")
          .select("*", { count: "exact", head: true });
        
        if (regError) throw regError;

        // Fetch members
        const { count: memberCount, error: membersError } = await supabase
          .from("members")
          .select("*", { count: "exact", head: true });
        
        if (membersError) throw membersError;

        // Build recent activity
        const recentActivity: RecentActivity[] = [];
        
        // Recent registrations
        const { data: recentRegs } = await supabase
          .from("program_registrations")
          .select("id, created_at, program:programs(name)")
          .order("created_at", { ascending: false })
          .limit(5);
        
        for (const reg of recentRegs || []) {
          recentActivity.push({
            id: reg.id,
            type: "registration",
            description: `New registration for "${(reg.program as any)?.name || 'Unknown Program'}"`,
            timestamp: reg.created_at,
          });
        }

        // Recent programs
        const { data: recentPrograms } = await supabase
          .from("programs")
          .select("id, name, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        
        for (const prog of recentPrograms || []) {
          recentActivity.push({
            id: prog.id,
            type: "program",
            description: `Program "${prog.name}" was created`,
            timestamp: prog.created_at,
          });
        }

        // Sort by timestamp
        recentActivity.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setStats({
          totalAdmins: adminData.length,
          activeAdmins: adminData.filter(a => a.is_active).length,
          totalDivisions: divisionData.length,
          activeDivisions: divisionData.filter(d => d.is_active).length,
          totalPrograms: programs?.length || 0,
          activePrograms: programs?.filter(p => p.is_active).length || 0,
          totalRegistrations: registrationCount || 0,
          totalMembers: memberCount || 0,
          admins: adminData,
          divisions: divisionData,
          recentActivity: recentActivity.slice(0, 10),
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        console.error("Error fetching super admin stats:", err);
        setStats(prev => ({
          ...prev,
          isLoading: false,
          error: err.message,
        }));
      }
    };

    fetchStats();
  }, [refreshKey]);

  const toggleAdminStatus = async (adminId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("admins")
      .update({ is_active: !currentStatus })
      .eq("id", adminId);
    
    if (error) throw error;
    refetch();
  };

  return { ...stats, toggleAdminStatus, refetch };
}
