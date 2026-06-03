export const parseHoursToMinutes = (hoursStr: string | number): number => {
  if (typeof hoursStr === "number") return Math.round(hoursStr * 60);
  if (!hoursStr) return 0;
  const s = String(hoursStr).trim();
  if (s.includes("h")) {
    const parts = s.split("h");
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h * 60 + m;
  }
  const f = parseFloat(s.replace(",", "."));
  return isNaN(f) ? 0 : Math.round(f * 60);
};

export const formatMinutesToHoursInput = (minutes: number): string => {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
};

export const statusLabel = (s: string): string => {
  switch (s) {
    case "ativo": return "Ativo";
    case "futuro": return "Futuro";
    case "encerrado":
    case "concluido": return "Encerrado";
    case "cancelado": return "Cancelado";
    case "pendente": return "Pendente";
    default: return s || "—";
  }
};

export const statusBadgeClasses = (s: string): string => {
  switch (s) {
    case "ativo": return "bg-accent/10 text-accent border-accent/30";
    case "futuro": return "bg-primary/10 text-primary border-primary/30";
    case "encerrado":
    case "concluido": return "bg-muted text-muted-foreground border-border";
    case "cancelado": return "bg-destructive/10 text-destructive border-destructive/30";
    case "pendente": return "bg-warning/10 text-warning border-warning/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};