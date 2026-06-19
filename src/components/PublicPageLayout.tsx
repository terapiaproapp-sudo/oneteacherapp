import { Link } from "react-router-dom";
import logo from "@/assets/logo-oneteacher.png";
import { MessageCircle } from "lucide-react";

const WHATSAPP_URL =
  "https://wa.me/5519997663294?text=Ol%C3%A1%21%20Preciso%20de%20ajuda%20com%20o%20OneTeacher.";

export default function PublicPageLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="OneTeacher" className="h-7 object-contain" />
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Voltar à página inicial
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            {title}
          </h1>
          {updatedAt && (
            <p className="text-xs text-muted-foreground mb-8">
              Última atualização: {updatedAt}
            </p>
          )}
          <div className="prose prose-sm sm:prose-base max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-foreground/90 prose-li:text-foreground/90 prose-a:text-primary">
            {children}
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 py-8 px-4 mt-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link to="/sobre" className="hover:text-foreground">Sobre</Link>
            <Link to="/contato" className="hover:text-foreground">Contato</Link>
            <Link to="/politica-de-privacidade" className="hover:text-foreground">Política de Privacidade</Link>
            <Link to="/termos-de-uso" className="hover:text-foreground">Termos de Uso</Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp: (19) 99766-3294
            </a>
          </div>
          <p>© {new Date().getFullYear()} OneTeacher. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

export { WHATSAPP_URL };