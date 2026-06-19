import { useEffect } from "react";
import { Navigate } from "react-router-dom";

/**
 * Antiga rota /checkout — agora apenas um redirecionamento seguro para /planos.
 *
 * Motivos:
 *  - O formulário antigo simulava pagamento (setTimeout) sem cobrança real.
 *  - Aceitava parâmetro `redirect` para URL externa arbitrária (open redirect).
 *  - O checkout oficial é externo (Newexy), iniciado a partir de /planos.
 *
 * Todas as querystrings são descartadas. Nenhuma chamada à API é feita aqui.
 */
export default function Checkout() {
  useEffect(() => {
    // Substitui o histórico para não deixar a URL antiga no back do navegador.
    window.history.replaceState(null, "", "/planos");
  }, []);

  return <Navigate to="/planos" replace />;
}