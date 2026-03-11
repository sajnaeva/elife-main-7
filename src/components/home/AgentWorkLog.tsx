import { useState, useEffect, useCallback } from "react";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isToday, parseISO } from "date-fns";
import { 
  CalendarDays, Save, Trash2, Loader2, ChevronLeft, ChevronRight, 
  FileText, User, Building2, MapPin, Users, ArrowUpRight 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AgentInfo {
  id: string;
  name: string;
  mobile: string;
  role: string;
  ward: string;
  customer_count: number;
  panchayath?: { name: string } | null;
  parent_agent_id: string | null;
}

interface ParentAgentInfo {
  name: string;
  role: string;
  mobile: string;
  panchayath?: { name: string } | null;
}

interface WorkLog {
  id: string;
  work_date: string;
  work_details: string;
  created_at: string;
  updated_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  team_leader: "Team Leader",
  coordinator: "Coordinator",
  group_leader: "Group Leader",
  pro: "PRO",
};

const ROLE_COLORS: Record<string, string> = {
  team_leader: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  coordinator: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  group_leader: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  pro: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

interface AgentWorkLogProps {
  agent: AgentInfo;
}

export function AgentWorkLog({ agent }: AgentWorkLogProps) {
  const [parentAgent, setParentAgent] = useState<ParentAgentInfo | null>(null);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [todayText, setTodayText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [existingTodayLog, setExistingTodayLog] = useState<WorkLog | null>(null);

  // Fetch parent agent info
  useEffect(() => {
    if (!agent.parent_agent_id) return;
    supabase
      .from("pennyekart_agents")
      .select("name, role, mobile, panchayath:panchayaths(name)")
      .eq("id", agent.parent_agent_id)
      .single()
      .then(({ data }) => {
        if (data) setParentAgent(data as unknown as ParentAgentInfo);
      });
  }, [agent.parent_agent_id]);

  // Fetch work logs for the visible month
  const fetchWorkLogs = useCallback(async () => {
    setIsLoading(true);
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const { data } = await supabase
      .from("agent_work_logs")
      .select("*")
      .eq("agent_id", agent.id)
      .gte("work_date", start)
      .lte("work_date", end)
      .order("work_date", { ascending: true });

    const logs = (data || []) as unknown as WorkLog[];
    setWorkLogs(logs);

    // Set today's text if exists
    const todayLog = logs.find(l => isSameDay(parseISO(l.work_date), new Date()));
    setExistingTodayLog(todayLog || null);
    if (todayLog && isSameDay(selectedDate, new Date())) {
      setTodayText(todayLog.work_details);
    }

    setIsLoading(false);
  }, [agent.id, currentMonth, selectedDate]);

  useEffect(() => {
    fetchWorkLogs();
  }, [fetchWorkLogs]);

  const handleSave = async () => {
    if (!todayText.trim()) return;
    setIsSaving(true);

    try {
      if (existingTodayLog) {
        const { error } = await supabase
          .from("agent_work_logs")
          .update({ work_details: todayText.trim() } as any)
          .eq("id", existingTodayLog.id);
        if (error) throw error;
        toast.success("Work log updated!");
      } else {
        const { error } = await supabase
          .from("agent_work_logs")
          .insert({
            agent_id: agent.id,
            work_details: todayText.trim(),
            work_date: format(new Date(), "yyyy-MM-dd"),
          } as any);
        if (error) throw error;
        toast.success("Work log saved!");
      }
      await fetchWorkLogs();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingTodayLog) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("agent_work_logs")
        .delete()
        .eq("id", existingTodayLog.id);
      if (error) throw error;
      setTodayText("");
      setExistingTodayLog(null);
      toast.success("Work log deleted");
      await fetchWorkLogs();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedLog = workLogs.find(l => isSameDay(parseISO(l.work_date), selectedDate));
  const isTodaySelected = isToday(selectedDate);

  // Calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = monthStart.getDay(); // 0=Sun

  const logsMap = new Map(workLogs.map(l => [l.work_date, l]));

  return (
    <div className="space-y-4 mt-4">
      {/* Agent Detail Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Agent Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold">{agent.name}</h3>
              <p className="text-xs text-muted-foreground">{agent.mobile}</p>
            </div>
            <Badge className={cn("text-xs", ROLE_COLORS[agent.role])}>
              {ROLE_LABELS[agent.role] || agent.role}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {agent.panchayath?.name && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {agent.panchayath.name}
              </span>
            )}
            {agent.ward !== "N/A" && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Ward {agent.ward}
              </span>
            )}
            {agent.role === "pro" && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {agent.customer_count} Customers
              </span>
            )}
          </div>

          {/* Reports To */}
          {parentAgent && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" /> Reports To
                </p>
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {ROLE_LABELS[parentAgent.role] || parentAgent.role}
                  </Badge>
                  <span className="text-sm font-medium">{parentAgent.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{parentAgent.mobile}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Today's Work Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Today's Work Log
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Enter today's work details..."
            value={todayText}
            onChange={(e) => setTodayText(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !todayText.trim()}
              className="flex-1"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {existingTodayLog ? "Update" : "Save"}
            </Button>
            {existingTodayLog && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSaving}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Calendar History */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Work History
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for offset */}
                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-9" />
                ))}

                {daysInMonth.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const isFuture = day > new Date();
                  if (isFuture) {
                    return <div key={dateStr} className="h-9" />;
                  }
                  const hasLog = logsMap.has(dateStr);
                  const isSelected = isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);
                  const isPast = !isTodayDate;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        setSelectedDate(day);
                        if (isTodayDate) {
                          const log = logsMap.get(dateStr);
                          setTodayText(log?.work_details || "");
                        }
                      }}
                      className={cn(
                        "h-9 w-full rounded-md text-xs font-medium transition-colors relative",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : isTodayDate
                          ? "bg-accent text-accent-foreground"
                          : isPast && hasLog
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : isPast && !hasLog
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          : "hover:bg-muted",
                      )}
                    >
                      {format(day, "d")}
                      {hasLog && (
                        <span
                          className={cn(
                            "absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full",
                            isSelected ? "bg-primary-foreground" : "bg-green-600"
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected date details */}
              {selectedLog && !isTodaySelected && (
                <div className="mt-3 p-3 rounded-lg border bg-muted/50">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{selectedLog.work_details}</p>
                </div>
              )}

              {!selectedLog && !isTodaySelected && (
                <div className="mt-3 p-3 rounded-lg border bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">
                    No work log for {format(selectedDate, "MMMM d, yyyy")}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
