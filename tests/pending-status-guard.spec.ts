import { test, expect } from '@playwright/test';

test.describe('Proteção de Plano Pendente', () => {
  test('deve mostrar mensagem e redirecionar ao acessar /dashboard com status pendente', async ({ page }) => {
    // Simula um usuário logado com perfil pendente via localStorage
    await page.addInitScript(() => {
      const session = {
        access_token: 'fake-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'fake-refresh-token',
        user: {
          id: 'user-id-pendente',
          email: 'pendente@example.com',
        },
      };
      window.localStorage.setItem('sb-lovable-auth-token', JSON.stringify(session));
    });

    // Intercepta a chamada de perfil para retornar um status pendente
    await page.route('**/rest/v1/profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'user-id-pendente',
          full_name: 'Usuário Pendente',
          plan: null,
          status: 'pendente',
          validade: null
        }])
      });
    });

    // 1. Tenta acessar o dashboard
    await page.goto('/dashboard');

    // 2. Verifica se a mensagem "Escolha um plano para começar" aparece antes do redirect completo
    // Usamos um seletor que aguarda a visibilidade da mensagem do Toast
    await expect(page.getByText('Escolha um plano para começar')).toBeVisible();

    // 3. Garante que o redirecionamento para /planos ocorreu
    await expect(page).toHaveURL(/.*planos/);
  });
});
