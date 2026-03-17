import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileText, Users, ChevronRight } from "lucide-react";
import { PennyekartAgent, ROLE_LABELS, ROLE_HIERARCHY, AgentRole } from "@/hooks/usePennyekartAgents";

interface ExportFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: PennyekartAgent[];
  onExport: (filteredAgents: PennyekartAgent[], format: "xlsx" | "pdf") => void;
}

/** Recursively collect all descendants of a given agent */
function collectBranch(agentId: string, allAgents: PennyekartAgent[]): PennyekartAgent[] {
  const result: PennyekartAgent[] = [];
  const children = allAgents.filter(a => a.parent_agent_id === agentId);
  for (const child of children) {
    result.push(child);
    result.push(...collectBranch(child.id, allAgents));
  }
  return result;
}

export function ExportFilterDialog({ open, onOpenChange, agents, onExport }: ExportFilterDialogProps) {
  const [selectedRole, setSelectedRole] = useState<AgentRole | "all">("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");

  // Roles that can be used as branch roots (have potential children)
  const filterableRoles: AgentRole[] = ["scode", "team_leader", "coordinator", "group_leader"];

  // Agents of the selected role
  const agentsOfRole = useMemo(() => {
    if (selectedRole === "all") return [];
    return agents.filter(a => a.role === selectedRole);
  }, [agents, selectedRole]);

  // Filtered agents for preview/export
  const filteredAgents = useMemo(() => {
    if (selectedRole === "all") return agents;
    if (selectedAgentId === "all") {
      // All branches of this role
      return agentsOfRole.flatMap(a => [a, ...collectBranch(a.id, agents)]);
    }
    const root = agents.find(a => a.id === selectedAgentId);
    if (!root) return [];
    return [root, ...collectBranch(root.id, agents)];
  }, [agents, selectedRole, selectedAgentId, agentsOfRole]);

  // Stats preview
  const roleStats = useMemo(() => {
    const stats: Partial<Record<AgentRole, number>> = {};
    for (const a of filteredAgents) {
      stats[a.role] = (stats[a.role] || 0) + 1;
    }
    return stats;
  }, [filteredAgents]);

  const handleRoleChange = (value: string) => {
    setSelectedRole(value as AgentRole | "all");
    setSelectedAgentId("all");
  };

  const handleExport = (format: "xlsx" | "pdf") => {
    onExport(filteredAgents, format);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Export Agents
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Filter by role */}
          <div className="space-y-2">
            <Label>Filter by branch</Label>
            <Select value={selectedRole} onValueChange={handleRoleChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {filterableRoles.map(role => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]} branches
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Select specific agent */}
          {selectedRole !== "all" && agentsOfRole.length > 0 && (
            <div className="space-y-2">
              <Label>Select {ROLE_LABELS[selectedRole]}</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${ROLE_LABELS[selectedRole]}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {ROLE_LABELS[selectedRole]}s</SelectItem>
                  {agentsOfRole.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.panchayath?.name || ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview */}
          <div className="rounded-md bg-muted/50 p-3 space-y-2">
            <p className="text-sm font-medium">Export preview</p>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_HIERARCHY.filter(r => roleStats[r]).map(role => (
                <Badge key={role} variant="secondary" className="text-xs">
                  {roleStats[role]} {ROLE_LABELS[role]}s
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredAgents.length} agent{filteredAgents.length !== 1 ? "s" : ""} will be exported
            </p>

            {/* Show hierarchy chain */}
            {selectedAgentId !== "all" && selectedRole !== "all" && (() => {
              const root = agents.find(a => a.id === selectedAgentId);
              if (!root) return null;
              const childRoles = ROLE_HIERARCHY.slice(ROLE_HIERARCHY.indexOf(root.role));
              return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 flex-wrap">
                  {childRoles.map((r, i) => (
                    <span key={r} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="h-3 w-3" />}
                      <span className={roleStats[r] ? "text-foreground font-medium" : ""}>{ROLE_LABELS[r]}</span>
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleExport("xlsx")}
            disabled={filteredAgents.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button
            onClick={() => handleExport("pdf")}
            disabled={filteredAgents.length === 0}
          >
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
