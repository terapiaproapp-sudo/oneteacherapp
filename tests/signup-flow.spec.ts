import { test, expect } from '@playwright/test';

test.describe('Fluxo de Cadastro e Plano', () => {
  test('deve redirecionar para /planos após cadastro e bloquear /dashboard sem plano', async ({ page }) => {
    const randomEmail = `test-${Math.random().toString(36).substring(7)}@example.com`;
    
    // 1. Ir para a página de cadastro
    await page.goto('/signup');
    
    // 2. Preencher formulário de cadastro
    await page.fill('input[placeholder="Digite seu nome"]', 'Professor Teste E2E');
    await page.fill('input[placeholder="+55 (11) 99999-9999"]', '5511999999999');
    
    // Selecionar país e região (dependendo de como o componente CountryDropdown funciona, 
    // pode ser necessário interagir com o select)
    await page.selectOption('select', { label: 'Brazil' }); 
    // Nota: O componente CountryDropdown costuma renderizar um select padrão se não for customizado.
    
    await page.fill('input[placeholder="Ex: São Paulo"]', 'São Paulo');
    await page.fill('input[placeholder="seu@email.com"]', randomEmail);
    await page.fill('input[placeholder="Mínimo 6 caracteres"]', 'Senha@123');
    await page.fill('input[placeholder="Repita a senha"]', 'Senha@123');
    
    // Aceitar termos
    await page.click('button[role="checkbox"]');
    
    // 3. Submeter cadastro
    await page.click('button:has-text("Criar conta agora")');
    
    // 4. Verificar redirecionamento para /planos
    // O sistema pode demorar um pouco para processar o cadastro e login automático (se houver)
    await expect(page).toHaveURL(/.*planos/, { timeout: 15000 });
    
    // 5. Tentar acessar o dashboard diretamente sem escolher plano
    await page.goto('/dashboard');
    
    // 6. Garantir que redirecionou de volta para /planos
    await expect(page).toHaveURL(/.*planos/);
    
    // 7. Verificar se a mensagem de erro apareceu (via toast)
    await expect(page.getByText('Escolha um plano para começar')).toBeVisible();
  });
});
