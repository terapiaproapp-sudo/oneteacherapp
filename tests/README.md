# Testes de E2E (Playwright)

Este diretório contém testes de ponta a ponta para garantir o funcionamento correto das funcionalidades críticas do sistema.

## Teste de Persistência de Autenticação

O teste em `tests/auth-persistence.spec.ts` verifica se o usuário permanece logado ao atualizar a página, garantindo que não haja redirecionamentos indevidos para a tela de login ou "piscadas" na interface.

### Como executar

1. Certifique-se de que as dependências do Playwright estão instaladas:
   ```bash
   npx playwright install
   ```

2. Execute o teste:
   ```bash
   npm run test:e2e
   ```

### O que o teste valida:
- **Estado de Carregamento:** Garante que o sistema aguarda a verificação da sessão antes de decidir por um redirecionamento.
- **Persistência:** Verifica se a sessão armazenada no `localStorage` é recuperada corretamente após um reload (`F5`).
- **Segurança:** Garante que rotas protegidas redirecionam para login caso não haja uma sessão ativa.
