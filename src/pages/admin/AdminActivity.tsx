import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Activity } from "lucide-react";
import { format } from "date-fns";

interface LogEntry {
  id: string;
  user_id: string;
  action: string;
  details: Record<string, any>;
  created_at: string;
  profile?: { email: string; full_name: string } | null;
}

export default function AdminActivity() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => { loadLogs(); }, [page]);

  const loadLogs = async () => {
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (data) {
      // Fetch profiles for the user_ids
      const userIds = [...new Set(data.map(l => l.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]));
      setLogs(data.map(l => ({ ...l, profile: profileMap.get(l.user_id) || null })));
    }
  };

  const filtered = logs.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.action.toLowerCase().includes(s) ||
      l.profile?.email?.toLowerCase().includes(s) ||
      l.profile?.full_name?.toLowerCase().includes(s);
  });

  const actionColor = (action: string) => {
    if (action.includes("login")) return "border-primary/30 text-primary";
    if (action.includes("cadastr") || action.includes("cri")) return "border-accent/30 text-accent";
    if (action.includes("exclu") || action.includes("delet")) return "border-destructive/30 text-destructive";
    return "border-muted-foreground/30 text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" /> Atividade do Sistema
        </h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por ação, email ou nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {filtered.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">Nenhum registro encontrado</p>
            )}
            {filtered.map(log => (
              <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={actionColor(log.action)}>
                      {log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {log.profile?.full_name || log.profile?.email || log.user_id.slice(0, 8)}
                    </span>
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {JSON.stringify(log.details).slice(0, 100)}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(log.created_at), "dd/MM HH:mm")}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-2">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-3 py-1 text-sm rounded-md border border-border disabled:opacity-40 hover:bg-muted transition-colors"
        >
          Anterior
        </button>
        <span className="px-3 py-1 text-sm text-muted-foreground">Página {page + 1}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={filtered.length < PAGE_SIZE}
          className="px-3 py-1 text-sm rounded-md border border-border disabled:opacity-40 hover:bg-muted transition-colors"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
