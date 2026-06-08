import { test, expect } from "../playwright-fixture";

/**
 * Verifica que a sessão do usuário persiste ao navegar entre rotas protegidas
 * (Dashboard, Agenda, Financeiro) e ao recarregar a página.
 *
 * Pré-requisito: o usuário precisa estar previamente logado no preview
 * (a sessão do Supabase é lida do localStorage compartilhado).
 */
test.describe("Persistência de sessão na navegação", () => {
  test("mantém usuário logado ao navegar Dashboard → Agenda → Financeiro e dar refresh", async ({ page }) => {
    // 1. Entrar no Dashboard
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/.*login/);
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });

    // 2. Navegar para Agenda
    await page.goto("/agenda");
    await expect(page).not.toHaveURL(/.*login/);
    await expect(page).toHaveURL(/.*agenda/);
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });

    // 3. Navegar para Financeiro
    await page.goto("/financeiro");
    await expect(page).not.toHaveURL(/.*login/);
    await expect(page).toHaveURL(/.*financeiro/);
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });

    // 4. Refresh — usuário deve continuar em /financeiro sem cair no login
    await page.reload();
    await expect(page).toHaveURL(/.*financeiro/);
    await expect(page).not.toHaveURL(/.*login/);
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10000 });

    // 5. Voltar para o Dashboard após refresh para confirmar que a sessão segue válida
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page).not.toHaveURL(/.*login/);
  });
});
