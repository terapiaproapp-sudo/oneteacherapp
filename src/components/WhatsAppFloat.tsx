import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";

const WHATSAPP_NUMBER = "5519997663294";
const MAX_LEN = 500;

export default function WhatsAppFloat() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    setTimeout(() => textareaRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Digite sua dúvida antes de continuar.");
      return;
    }
    setError(null);
    const message = `Olá! Estou no site do OneTeacher e tenho esta dúvida: ${trimmed}`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setText("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      {open && (
        <div
          role="dialog"
          aria-label="Atendimento via WhatsApp"
          className="mb-3 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border bg-card text-card-foreground shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Precisa de ajuda?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Escreva sua dúvida e fale com o OneTeacher pelo WhatsApp.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                const v = e.target.value.slice(0, MAX_LEN);
                setText(v);
                if (error && v.trim()) setError(null);
              }}
              placeholder="Digite sua pergunta..."
              maxLength={MAX_LEN}
              rows={4}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex items-center justify-between text-xs">
              <span className={error ? "text-destructive" : "text-muted-foreground"}>
                {error ?? `${text.length}/${MAX_LEN}`}
              </span>
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#22A851] px-4 py-2 text-sm font-medium text-white shadow hover:bg-[#1e9648] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition"
            >
              <Send className="h-4 w-4" />
              Enviar no WhatsApp
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar atendimento WhatsApp" : "Abrir atendimento WhatsApp"}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#22A851] text-white shadow-lg hover:bg-[#1e9648] hover:scale-105 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}