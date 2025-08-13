import { useState, useEffect } from "react";
import { BarChart3, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface UtilizationData {
  id: string;
  system_name?: string;
  subsystem_name?: string;
  username: string;
  duration_minutes: number | null;
  locked_at: string;
  unlocked_at: string | null;
}

const UtilizationStats = () => {
  const [systemUtilization, setSystemUtilization] = useState<UtilizationData[]>([]);
  const [subsystemUtilization, setSubsystemUtilization] = useState<UtilizationData[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchUtilizationData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch system utilization with system names and user info
      const { data: systemData, error: systemError } = await supabase
        .from('system_utilization')
        .select(`
          *,
          systems(name),
          profiles!system_utilization_user_id_fkey(username)
        `)
        .order('locked_at', { ascending: false })
        .limit(50);

      if (systemError) throw systemError;

      // Fetch subsystem utilization with names and user info
      const { data: subsystemData, error: subsystemError } = await supabase
        .from('subsystem_utilization')
        .select(`
          *,
          subsystems(name),
          systems(name),
          profiles!subsystem_utilization_user_id_fkey(username)
        `)
        .order('locked_at', { ascending: false })
        .limit(50);

      if (subsystemError) throw subsystemError;

      // Transform the data
      const transformedSystemData = systemData?.map(item => ({
        id: item.id,
        system_name: (item.systems as any)?.name,
        username: (item.profiles as any)?.username || 'Unknown',
        duration_minutes: item.duration_minutes,
        locked_at: item.locked_at,
        unlocked_at: item.unlocked_at,
      })) || [];

      const transformedSubsystemData = subsystemData?.map(item => ({
        id: item.id,
        system_name: (item.systems as any)?.name,
        subsystem_name: (item.subsystems as any)?.name,
        username: (item.profiles as any)?.username || 'Unknown',
        duration_minutes: item.duration_minutes,
        locked_at: item.locked_at,
        unlocked_at: item.unlocked_at,
      })) || [];

      setSystemUtilization(transformedSystemData);
      setSubsystemUtilization(transformedSubsystemData);
    } catch (error) {
      console.error('Error fetching utilization data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUtilizationData();
  }, [user]);

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "Still active";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalSystemTime = systemUtilization
    .filter(item => item.duration_minutes)
    .reduce((acc, item) => acc + (item.duration_minutes || 0), 0);

  const totalSubsystemTime = subsystemUtilization
    .filter(item => item.duration_minutes)
    .reduce((acc, item) => acc + (item.duration_minutes || 0), 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Utilization Stats
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            System Utilization Statistics
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total System Time</p>
                    <p className="text-lg font-semibold">{formatDuration(totalSystemTime)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Subsystem Time</p>
                    <p className="text-lg font-semibold">{formatDuration(totalSubsystemTime)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Sessions</p>
                    <p className="text-lg font-semibold">
                      {systemUtilization.length + subsystemUtilization.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Utilization */}
          <div>
            <h3 className="text-lg font-semibold mb-3">System Usage History</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {systemUtilization.length === 0 ? (
                <p className="text-muted-foreground text-sm">No system usage data available.</p>
              ) : (
                systemUtilization.map((item) => (
                  <Card key={item.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{item.system_name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {item.username}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Started: {formatDate(item.locked_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={item.unlocked_at ? "outline" : "default"}
                          className={item.unlocked_at ? "" : "bg-blue-100 text-blue-800"}
                        >
                          {formatDuration(item.duration_minutes)}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Subsystem Utilization */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Subsystem Usage History</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {subsystemUtilization.length === 0 ? (
                <p className="text-muted-foreground text-sm">No subsystem usage data available.</p>
              ) : (
                subsystemUtilization.map((item) => (
                  <Card key={item.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {item.system_name} › {item.subsystem_name}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {item.username}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Started: {formatDate(item.locked_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={item.unlocked_at ? "outline" : "default"}
                          className={item.unlocked_at ? "" : "bg-green-100 text-green-800"}
                        >
                          {formatDuration(item.duration_minutes)}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UtilizationStats;