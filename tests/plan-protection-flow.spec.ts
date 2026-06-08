import { test, expect } from '@playwright/test';

test.describe('Fluxo de Cadastro e Proteção de Plano', () => {
  test('deve redirecionar para /planos ao acessar /dashboard sem plano definido', async ({ page }) => {
    const email = `test-${Math.random()}@example.com`;
    const password = 'Password123!';

    // 1. Ir para a página de cadastro
    await page.goto('/cadastro');
    
    // 2. Preencher formulário de cadastro
    await page.fill('input[placeholder*="Nome"]', 'Professor Teste');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // 3. Verificar se foi redirecionado para /planos após o cadastro
    await expect(page).toHaveURL(/.*planos/);

    // 4. Tentar acessar o /dashboard diretamente
    await page.goto('/dashboard');

    // 5. Verificar se apareceu o Toast/Mensagem de aviso
    // A mensagem solicitada é "Escolha um plano para continuar" (ou similar conforme implementado anteriormente)
    const toast = page.locator('text=Escolha um plano para continuar');
    await expect(toast).toBeVisible();

    // 6. Garantir que foi redirecionado de volta para /planos
    await expect(page).toHaveURL(/.*planos/);
  });
});
