import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Phone, 
  MapPin, 
  Building2, 
  Users, 
  Calendar,
  Shield,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  PennyekartAgent, 
  ROLE_LABELS, 
  AgentRole,
} from "@/hooks/usePennyekartAgents";

const ROLE_COLORS: Record<AgentRole, string> = {
  scode: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  team_leader: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  coordinator: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  group_leader: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  pro: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
};

const ROLE_GRADIENT: Record<AgentRole, string> = {
  scode: "from-rose-500/10 to-rose-500/5",
  team_leader: "from-purple-500/10 to-purple-500/5",
  coordinator: "from-blue-500/10 to-blue-500/5",
  group_leader: "from-green-500/10 to-green-500/5",
  pro: "from-orange-500/10 to-orange-500/5",
};

const AVATAR_BG: Record<AgentRole, string> = {
  scode: "bg-rose-200 text-rose-700 dark:bg-rose-800 dark:text-rose-200",
  team_leader: "bg-purple-200 text-purple-700 dark:bg-purple-800 dark:text-purple-200",
  coordinator: "bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-200",
  group_leader: "bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-200",
  pro: "bg-orange-200 text-orange-700 dark:bg-orange-800 dark:text-orange-200",
};

interface AgentProfileCardProps {
  agent: PennyekartAgent;
  allAgents: PennyekartAgent[];
  panchayaths?: { id: string; name: string }[];
  onClick?: () => void;
  isSelected?: boolean;
}

export function AgentProfileCard({ agent, allAgents, panchayaths, onClick, isSelected }: AgentProfileCardProps) {
  const directReports = allAgents.filter(a => a.parent_agent_id === agent.id);
  const parentAgent = allAgents.find(a => a.id === agent.parent_agent_id);
  
  const calculateTotalCustomers = (a: PennyekartAgent, visited = new Set<string>()): number => {
    if (visited.has(a.id)) return 0;
    visited.add(a.id);
    if (a.role === "pro") return a.customer_count;
    const children = allAgents.filter(c => c.parent_agent_id === a.id);
    return children.reduce((sum, child) => sum + calculateTotalCustomers(child, visited), 0);
  };
  
  const totalCustomers = calculateTotalCustomers(agent);
  const initials = agent.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  
  // Get responsible panchayath names
  const responsiblePanchayathNames = (agent.responsible_panchayath_ids || [])
    .map(id => {
      const p = panchayaths?.find(p => p.id === id);
      return p?.name || null;
    })
    .filter(Boolean);

  return (
    <Card 
      className={cn(
        "overflow-hidden cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary shadow-md"
      )}
      onClick={onClick}
    >
      {/* Header gradient */}
      <div className={cn("h-2 bg-gradient-to-r", ROLE_GRADIENT[agent.role])} />
      
      <CardContent className="p-4">
        {/* Profile header */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar className={cn("h-12 w-12 text-lg font-bold", AVATAR_BG[agent.role])}>
            <AvatarFallback className={AVATAR_BG[agent.role]}>
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
            <Badge className={cn("text-[10px] px-1.5 py-0 mt-0.5", ROLE_COLORS[agent.role])}>
              {ROLE_LABELS[agent.role]}
            </Badge>
            {!agent.is_active && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 mt-0.5 ml-1">
                Inactive
              </Badge>
            )}
          </div>
        </div>
        
        {/* Contact & location */}
        <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span>{agent.mobile}</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{agent.panchayath?.name || "Unknown"}</span>
          </div>
          {agent.ward !== "N/A" && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span>Ward {agent.ward}</span>
            </div>
          )}
          {parentAgent && (
            <div className="flex items-center gap-2">
              <Shield className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">Reports to: {parentAgent.name}</span>
            </div>
          )}
        </div>
        
        {/* Responsible areas */}
        {responsiblePanchayathNames.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="mb-2">
              <p className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Network className="h-3 w-3" />
                Responsible Panchayaths
              </p>
              <div className="flex flex-wrap gap-1">
                {responsiblePanchayathNames.map((name, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
        
        {/* Stats row */}
        <Separator className="my-2" />
        <div className="flex items-center justify-between text-xs">
          {agent.role === "pro" ? (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-3 w-3" />
              <span className="font-semibold text-foreground">{agent.customer_count}</span> customers
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-3 w-3" />
                <span className="font-semibold text-foreground">{directReports.length}</span> reports
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-3 w-3" />
                <span className="font-semibold text-foreground">{totalCustomers}</span> customers
              </div>
            </>
          )}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{new Date(agent.created_at).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
