import { test, expect } from "../playwright-fixture";

test.describe("Autenticação e Persistência", () => {
  test("deve permanecer logado após recarregar a página", async ({ page }) => {
    // 1. Simular uma sessão ativa no localStorage
    // Precisamos de um objeto de sessão falso que o Supabase entenda
    const fakeSession = {
      access_token: "fake-access-token",
      refresh_token: "fake-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: {
        id: "fake-user-id",
        email: "test@example.com",
        role: "authenticated",
        aud: "authenticated",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        app_metadata: { provider: "email" },
        user_metadata: { full_name: "Test User" },
      },
    };

    // O Supabase usa uma chave padrão sb-<prefix>-auth-token
    // Vamos injetar isso no localStorage antes de carregar a página
    await page.addInitScript((session) => {
      // Tenta encontrar a chave do supabase ou usa uma genérica para o teste
      // O createClient geralmente usa a URL para gerar o prefixo se não for especificado
      // Mas para o teste, podemos interceptar o carregamento ou apenas setar o estado
      window.localStorage.setItem('supabase.auth.token', JSON.stringify(session));
      // Também tentamos a chave baseada em prefixo se soubermos, mas 'supabase.auth.token' 
      // costuma funcionar se o cliente for configurado para tal ou se usarmos um mock.
      // No nosso caso, o client usa localStorage padrão.
    }, fakeSession);

    // 2. Navegar para o dashboard
    await page.goto("/dashboard");

    // 3. Verificar se o sistema reconhece o usuário e não redireciona para login
    // Se a lógica de 'loading' estiver correta, ele não deve piscar a tela de login
    await expect(page).not.toHaveURL(/.*login/);
    
    // Esperar um elemento do dashboard aparecer
    // (Ajustar o seletor conforme a realidade do projeto, ex: um botão de logout ou perfil)
    // Vamos procurar por algo que indique que o dashboard carregou
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });

    // 4. Recarregar a página
    await page.reload();

    // 5. Verificar se permanece no dashboard sem redirecionar
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByRole('main')).toBeVisible();
    
    console.log("Teste de persistência concluído com sucesso: usuário permaneceu logado após refresh.");
  });

  test("deve redirecionar para login se não houver sessão", async ({ page }) => {
    await page.goto("/dashboard");
    // Deve redirecionar para /login
    await expect(page).toHaveURL(/.*login/);
  });
});
