import { Button } from "@/components/ui/button";
import { MessageCircle, Phone } from "lucide-react";
import PublicPageLayout, { WHATSAPP_URL } from "@/components/PublicPageLayout";
import Seo from "@/components/Seo";

export default function Contato() {
  return (
    <>
      <Seo
        title="Contato e suporte | OneTeacher"
        description="Fale com a equipe do OneTeacher pelo WhatsApp. Tire dúvidas, peça ajuda ou conheça melhor a plataforma para professores particulares."
      />
      <PublicPageLayout title="Contato e suporte">
        <p>
          Precisa de ajuda, encontrou algum problema ou quer saber mais sobre o
          OneTeacher? Entre em contato com nossa equipe.
        </p>

        <h2>WhatsApp</h2>
        <p className="not-prose flex items-center gap-2 text-base">
          <Phone className="h-4 w-4 text-primary" />
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            (19) 99766-3294
          </a>
        </p>

        <div className="not-prose mt-4">
          <Button asChild size="lg" className="rounded-xl">
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar pelo WhatsApp
            </a>
          </Button>
        </div>

        <h2 className="mt-10">Horário de atendimento</h2>
        <p>
          Envie sua mensagem pelo WhatsApp. Responderemos assim que possível.
        </p>
      </PublicPageLayout>
    </>
  );
}