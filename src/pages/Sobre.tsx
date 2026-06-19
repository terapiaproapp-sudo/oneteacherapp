import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import PublicPageLayout, { WHATSAPP_URL } from "@/components/PublicPageLayout";
import Seo from "@/components/Seo";

export default function Sobre() {
  return (
    <>
      <Seo
        title="Sobre o OneTeacher | Gestão para professores particulares"
        description="Conheça o OneTeacher: a plataforma que ajuda professores particulares a organizar alunos, aulas, pacotes, agenda e pagamentos em um único lugar."
      />
      <PublicPageLayout title="Sobre o OneTeacher">
        <p>
          O OneTeacher é uma plataforma criada para ajudar professores
          particulares a organizar alunos, aulas, pacotes de horas, agenda e
          pagamentos em um único lugar.
        </p>
        <p>
          O sistema foi pensado para profissionais que dão aulas online ou
          presenciais e precisam reduzir o uso de planilhas, cadernos e
          controles separados.
        </p>
        <p>
          Com o OneTeacher, o professor pode acompanhar sua rotina de forma
          mais clara, organizada e profissional, mantendo informações
          importantes centralizadas e acessíveis.
        </p>

        <h2>Nossa proposta</h2>
        <p>
          Nossa proposta é tornar a gestão das aulas particulares mais simples,
          para que o professor possa dedicar mais tempo ao ensino e menos tempo
          às tarefas administrativas.
        </p>

        <h2>Para quem é</h2>
        <p>
          O OneTeacher atende professores particulares de diferentes áreas,
          disciplinas e modalidades, incluindo aulas online e presenciais.
        </p>

        <div className="not-prose mt-8">
          <Button asChild size="lg" className="rounded-xl">
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar com o OneTeacher
            </a>
          </Button>
        </div>
      </PublicPageLayout>
    </>
  );
}