import PublicPageLayout, { WHATSAPP_URL } from "@/components/PublicPageLayout";
import Seo from "@/components/Seo";

export default function PoliticaDePrivacidade() {
  return (
    <>
      <Seo
        title="Política de Privacidade | OneTeacher"
        description="Saiba como o OneTeacher coleta, utiliza, armazena e protege os dados pessoais de professores e alunos cadastrados na plataforma."
        path="/politica-de-privacidade"
      />
      <PublicPageLayout
        title="Política de Privacidade"
        updatedAt="19/06/2026"
      >
        <h2>1. Sobre o OneTeacher</h2>
        <p>
          O OneTeacher é uma plataforma online voltada a professores
          particulares, oferecendo ferramentas para gestão de alunos, aulas,
          pacotes de horas, agenda e controle financeiro.
        </p>
        <p>
          Esta Política de Privacidade descreve como tratamos os dados pessoais
          coletados durante o uso da plataforma.
        </p>

        <h2>2. Dados coletados do professor</h2>
        <p>Durante o cadastro e o uso da plataforma, podemos coletar:</p>
        <ul>
          <li>nome completo;</li>
          <li>endereço de e-mail;</li>
          <li>número de WhatsApp;</li>
          <li>país, estado e cidade;</li>
          <li>senha de acesso (armazenada de forma criptografada);</li>
          <li>
            dados de uso da plataforma, como acessos, ações realizadas e
            registros de atividade.
          </li>
        </ul>

        <h2>3. Dados cadastrados pelo professor sobre seus alunos</h2>
        <p>
          O professor é responsável pelos dados que cadastra sobre seus alunos,
          que podem incluir:
        </p>
        <ul>
          <li>nome do aluno;</li>
          <li>telefone e e-mail;</li>
          <li>disciplina, modalidade (online ou presencial) e status;</li>
          <li>anotações inseridas pelo professor;</li>
          <li>histórico de aulas, pacotes contratados e pagamentos.</li>
        </ul>
        <p>
          Ao cadastrar dados de terceiros, o professor declara possuir base
          legítima para tratá-los e se compromete a informar seus alunos sobre
          essa coleta quando aplicável.
        </p>

        <h2>4. Finalidade do tratamento</h2>
        <ul>
          <li>permitir o acesso e o uso da plataforma;</li>
          <li>autenticar o professor e proteger sua conta;</li>
          <li>
            organizar aulas, pacotes, agenda e informações financeiras;
          </li>
          <li>
            viabilizar a cobrança e o controle de assinaturas e pagamentos;
          </li>
          <li>prestar suporte ao usuário;</li>
          <li>melhorar a experiência e a estabilidade do serviço.</li>
        </ul>

        <h2>5. Armazenamento e segurança</h2>
        <p>
          Os dados são armazenados em infraestrutura de nuvem fornecida por
          parceiros tecnológicos contratados pelo OneTeacher, com uso de
          criptografia em trânsito e controles de acesso baseados em
          autenticação.
        </p>
        <p>
          Adotamos medidas técnicas e organizacionais razoáveis para proteger
          os dados contra acesso não autorizado, perda ou alteração indevida.
          Nenhum sistema, contudo, é totalmente imune a falhas, e o professor
          deve manter sua senha em sigilo.
        </p>

        <h2>6. Compartilhamento com prestadores e integrações</h2>
        <p>
          Para operar a plataforma, podemos compartilhar dados estritamente
          necessários com prestadores de serviço, incluindo:
        </p>
        <ul>
          <li>provedor de banco de dados e autenticação;</li>
          <li>provedor de processamento de pagamentos das assinaturas;</li>
          <li>provedor de envio de notificações.</li>
        </ul>
        <p>
          Esses prestadores tratam os dados apenas para as finalidades
          contratadas pelo OneTeacher.
        </p>

        <h2>7. Autenticação</h2>
        <p>
          O acesso à área restrita é realizado por e-mail e senha. A senha é
          armazenada de forma criptografada por nosso provedor de
          autenticação, e o OneTeacher não tem acesso ao seu valor original.
        </p>

        <h2>8. Pagamentos e assinaturas</h2>
        <p>
          O pagamento das assinaturas é processado por um parceiro externo de
          checkout. Dados financeiros sensíveis, como número completo de
          cartão, são tratados diretamente pelo provedor de pagamento e não
          ficam armazenados no OneTeacher.
        </p>

        <h2>9. Cookies e tecnologias semelhantes</h2>
        <p>
          A plataforma utiliza tecnologias de armazenamento local do navegador
          necessárias ao funcionamento da sessão e da autenticação. Esses
          recursos não são utilizados para perfis publicitários.
        </p>

        <h2>10. Notificações</h2>
        <p>
          Caso o professor autorize, podemos enviar notificações por meio do
          navegador para auxiliá-lo na rotina da plataforma. A autorização
          pode ser revogada a qualquer momento nas configurações do dispositivo.
        </p>

        <h2>11. Conservação dos dados</h2>
        <p>
          Os dados são mantidos enquanto a conta do professor estiver ativa e
          pelo tempo necessário para cumprir as finalidades descritas nesta
          política ou obrigações legais aplicáveis.
        </p>

        <h2>12. Direitos do titular</h2>
        <p>
          O titular dos dados pode solicitar informações sobre o tratamento de
          seus dados pessoais, bem como correção, atualização ou exclusão,
          observados os limites legais aplicáveis.
        </p>

        <h2>13. Correção e exclusão de dados</h2>
        <p>
          O professor pode editar seus dados de cadastro e os dados dos alunos
          diretamente na plataforma. Para solicitar a exclusão da conta, basta
          entrar em contato pelo canal indicado abaixo.
        </p>

        <h2>14. Responsabilidades do professor</h2>
        <p>
          O professor é o responsável pelos dados que insere sobre seus alunos
          e deve garantir que possui autorização para esse tratamento, bem
          como informar seus alunos quando necessário.
        </p>

        <h2>15. Dados de crianças e adolescentes</h2>
        <p>
          Caso o professor cadastre informações sobre alunos menores de idade,
          é sua responsabilidade obter a devida autorização dos responsáveis
          legais e limitar a coleta ao estritamente necessário para a
          prestação das aulas.
        </p>

        <h2>16. Contato para assuntos de privacidade</h2>
        <p>
          Para tratar de qualquer assunto relacionado a esta Política de
          Privacidade, entre em contato pelo WhatsApp:{" "}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            (19) 99766-3294
          </a>
          .
        </p>

        <h2>17. Alterações nesta política</h2>
        <p>
          Esta política pode ser atualizada a qualquer momento. Recomendamos a
          consulta periódica desta página. Alterações relevantes serão
          sinalizadas pela atualização da data indicada no topo.
        </p>
      </PublicPageLayout>
    </>
  );
}