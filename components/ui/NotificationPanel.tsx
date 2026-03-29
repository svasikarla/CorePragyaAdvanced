"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Bell, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function NotificationPanel({ userId }: { userId: string }) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function fetchAlerts() {
      const { data, error } = await supabase
        .from('proactive_alerts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (!error && data) {
         setAlerts(data);
         setUnreadCount(data.filter(a => a.resolved_status === 'pending').length);
      }
    }
    fetchAlerts();
  }, [userId]);

  const markResolved = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('proactive_alerts').update({ resolved_status: 'resolved' }).eq('id', id);
    setAlerts(alerts.map(a => a.id === id ? { ...a, resolved_status: 'resolved' } : a));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between mb-2">
           <h4 className="font-semibold leading-none">Notifications</h4>
           {unreadCount > 0 && <Badge variant="destructive">{unreadCount} New</Badge>}
        </div>
        <div className="space-y-3 mt-4 max-h-[300px] overflow-y-auto">
          {alerts.length > 0 ? alerts.map((alert) => (
            <div key={alert.id} className="text-sm flex flex-col gap-1 border-b pb-2 last:border-0">
               <div className="flex items-center gap-2 font-medium">
                  {alert.type === 'contradiction' ? (
                     <AlertTriangle className="h-4 w-4 text-orange-500" />
                  ) : (
                     <Clock className="h-4 w-4 text-blue-500" />
                  )}
                  {alert.type.toUpperCase()}
               </div>
               <p className="text-muted-foreground">{alert.description}</p>
               {alert.resolved_status === 'pending' && (
                  <Button variant="ghost" size="sm" onClick={(e) => markResolved(alert.id, e)} className="self-start h-6 mt-1 text-xs">
                     <CheckCircle className="h-3 w-3 mr-1" /> Mark Resolved
                  </Button>
               )}
            </div>
          )) : (
            <p className="text-sm text-muted-foreground text-center py-4">No recent notifications.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
