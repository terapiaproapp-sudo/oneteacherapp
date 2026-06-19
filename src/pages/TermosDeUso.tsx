import PublicPageLayout, { WHATSAPP_URL } from "@/components/PublicPageLayout";
import Seo from "@/components/Seo";

export default function TermosDeUso() {
  return (
    <>
      <Seo
        title="Termos de Uso | OneTeacher"
        description="Leia os Termos de Uso do OneTeacher: regras para utilização da plataforma, cadastro, assinaturas, cancelamento e responsabilidades."
        path="/termos-de-uso"
      />
      <PublicPageLayout title="Termos de Uso" updatedAt="19/06/2026">
        <h2>1. Aceitação dos termos</h2>
        <p>
          Ao criar uma conta ou utilizar o OneTeacher, o usuário declara que
          leu, compreendeu e concorda integralmente com estes Termos de Uso.
        </p>

        <h2>2. Descrição do serviço</h2>
        <p>
          O OneTeacher é uma plataforma online destinada a professores
          particulares, com funcionalidades para gestão de alunos, aulas,
          pacotes de horas, agenda e controle financeiro.
        </p>

        <h2>3. Cadastro e responsabilidade pela conta</h2>
        <p>
          O usuário é responsável pelas informações fornecidas no cadastro e
          pela guarda das credenciais de acesso. Toda atividade realizada na
          conta é considerada de responsabilidade do titular.
        </p>

        <h2>4. Uso permitido</h2>
        <p>
          O OneTeacher pode ser utilizado para a gestão profissional das
          aulas particulares do usuário e dos dados administrativos
          relacionados a seus alunos.
        </p>

        <h2>5. Uso proibido</h2>
        <ul>
          <li>utilizar a plataforma para fins ilícitos;</li>
          <li>
            tentar acessar áreas, contas ou dados de outros usuários sem
            autorização;
          </li>
          <li>
            realizar engenharia reversa, copiar ou redistribuir o software;
          </li>
          <li>
            inserir dados de terceiros sem possuir base legítima para esse
            tratamento.
          </li>
        </ul>

        <h2>6. Responsabilidade pelos dados de alunos</h2>
        <p>
          O professor é o responsável pelas informações que cadastra sobre
          seus alunos. Cabe a ele garantir que possui autorização para
          tratá-las e mantê-las atualizadas.
        </p>

        <h2>7. Pacotes, agenda e financeiro</h2>
        <p>
          As ferramentas de pacotes, agenda e controle financeiro são
          oferecidas como apoio administrativo. Os cálculos e registros são
          gerados a partir das informações inseridas pelo professor, que deve
          revisar a consistência dos dados.
        </p>

        <h2>8. Período de teste gratuito</h2>
        <p>
          O OneTeacher pode oferecer um período de teste gratuito de 7 dias
          para novos professores, com acesso às funcionalidades disponíveis no
          plano. Após o término do período, o acesso fica condicionado à
          contratação de um plano pago.
        </p>

        <h2>9. Planos e assinaturas</h2>
        <p>
          O OneTeacher disponibiliza planos com diferentes periodicidades
          (mensal, semestral e anual). Os valores e condições vigentes estão
          apresentados na página de planos.
        </p>

        <h2>10. Pagamentos</h2>
        <p>
          Os pagamentos são processados por parceiro externo de checkout,
          sujeitos às condições do meio de pagamento escolhido pelo usuário.
        </p>

        <h2>11. Cancelamento</h2>
        <p>
          O usuário pode solicitar o cancelamento de sua assinatura a
          qualquer momento. O acesso permanece disponível até o término do
          ciclo já pago, salvo indicação em contrário.
        </p>

        <h2>12. Limitações do serviço</h2>
        <p>
          O OneTeacher oferece ferramentas de apoio à gestão, mas não
          substitui o julgamento profissional do professor sobre suas aulas,
          alunos e operações financeiras.
        </p>

        <h2>13. Indisponibilidade e manutenção</h2>
        <p>
          A plataforma pode passar por períodos de manutenção, atualização
          ou indisponibilidade temporária. Sempre que possível, esses
          períodos serão minimizados.
        </p>

        <h2>14. Propriedade intelectual</h2>
        <p>
          A marca, o software, o design, os textos e demais elementos do
          OneTeacher pertencem aos seus titulares e são protegidos por
          legislação aplicável. O uso da plataforma não transfere qualquer
          direito de propriedade intelectual ao usuário.
        </p>

        <h2>15. Suspensão por uso indevido</h2>
        <p>
          O OneTeacher pode suspender contas que descumpram estes termos ou
          comprometam a segurança e o bom funcionamento da plataforma.
        </p>

        <h2>16. Encerramento da conta</h2>
        <p>
          O usuário pode encerrar sua conta a qualquer momento entrando em
          contato pelo canal indicado abaixo. O encerramento implica a
          interrupção do acesso às funcionalidades.
        </p>

        <h2>17. Privacidade</h2>
        <p>
          O tratamento de dados pessoais é regido pela Política de
          Privacidade do OneTeacher, parte integrante destes termos.
        </p>

        <h2>18. Alterações nos termos</h2>
        <p>
          Estes termos podem ser atualizados periodicamente. Alterações
          relevantes serão sinalizadas pela atualização da data indicada no
          topo da página.
        </p>

        <h2>19. Canal de contato</h2>
        <p>
          Para dúvidas ou solicitações relacionadas a estes termos, entre em
          contato pelo WhatsApp:{" "}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            (19) 99766-3294
          </a>
          .
        </p>
      </PublicPageLayout>
    </>
  );
}