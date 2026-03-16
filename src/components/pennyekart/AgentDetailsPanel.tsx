import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Phone, 
  MapPin, 
  Building2, 
  Users, 
  Edit, 
  Trash2, 
  UserPlus,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  PennyekartAgent, 
  ROLE_LABELS, 
  AgentRole,
  getChildRole 
} from "@/hooks/usePennyekartAgents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AgentDetailsPanelProps {
  agent: PennyekartAgent;
  allAgents: PennyekartAgent[];
  onEdit: () => void;
  onDelete: () => void;
  onAddChild: () => void;
  onClose: () => void;
}

const ROLE_COLORS: Record<AgentRole, string> = {
  scode: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  team_leader: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  coordinator: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  group_leader: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  pro: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
};

export function AgentDetailsPanel({ 
  agent, 
  allAgents, 
  onEdit, 
  onDelete, 
  onAddChild,
  onClose 
}: AgentDetailsPanelProps) {
  const childRole = getChildRole(agent.role);
  const directReports = allAgents.filter(a => a.parent_agent_id === agent.id);
  const parentAgent = allAgents.find(a => a.id === agent.parent_agent_id);

  // Calculate total customers under this agent
  const calculateTotalCustomers = (a: PennyekartAgent): number => {
    if (a.role === "pro") return a.customer_count;
    const children = allAgents.filter(c => c.parent_agent_id === a.id);
    return children.reduce((sum, child) => sum + calculateTotalCustomers(child), 0);
  };

  const totalCustomers = calculateTotalCustomers(agent);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between pb-2 sm:pb-3 px-3 sm:px-6 py-3 sm:py-4">
        <div>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <User className="h-4 w-4 sm:h-5 sm:w-5" />
            Agent Details
          </CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
        {/* Basic Info */}
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
            <h3 className="text-lg sm:text-xl font-semibold">{agent.name}</h3>
            <Badge className={cn("text-xs", ROLE_COLORS[agent.role])}>
              {ROLE_LABELS[agent.role]}
            </Badge>
          </div>

          <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span>{agent.mobile}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">{agent.panchayath?.name || "Unknown"}</span>
            </div>
            {agent.ward !== "N/A" && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Ward: {agent.ward}</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Hierarchy Info */}
        <div className="space-y-3">
          {parentAgent && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Reports To</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-normal">
                  {ROLE_LABELS[parentAgent.role]}
                </Badge>
                <span className="text-sm font-medium">{parentAgent.name}</span>
              </div>
            </div>
          )}

          {directReports.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Direct Reports ({directReports.length})
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {directReports.map((report) => (
                  <div key={report.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="font-normal text-xs">
                      {ROLE_LABELS[report.role]}
                    </Badge>
                    <span>{report.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {agent.role === "pro" ? (
            <div className="p-3 bg-muted rounded-lg text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{agent.customer_count}</p>
              <p className="text-xs text-muted-foreground">Customers</p>
            </div>
          ) : (
            <>
              <div className="p-3 bg-muted rounded-lg text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{directReports.length}</p>
                <p className="text-xs text-muted-foreground">Direct Reports</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{totalCustomers}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={onEdit} className="w-full" size="sm">
            <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
            Edit Agent
          </Button>
          
          {childRole && (
            <Button variant="outline" onClick={onAddChild} className="w-full" size="sm">
              <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
              Add {ROLE_LABELS[childRole]}
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" size="sm">
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Agent?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {agent.name}. 
                  {directReports.length > 0 && (
                    <span className="block mt-2 text-destructive">
                      Warning: This agent has {directReports.length} direct reports that will become orphaned.
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
