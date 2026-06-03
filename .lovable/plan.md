
# Renovação de pacotes — Histórico por aluno

## Objetivo
Permitir que a professora adicione novos pacotes para o mesmo aluno sem sobrescrever os antigos, mantendo histórico completo, financeiro vinculado e consumo correto na agenda.

## O que NÃO vai mudar
- Estrutura visual da Agenda, Recorrência, Financeiro e Pacotes existentes.
- Aulas antigas (realizadas, no-show, sem package_id) ficam intactas.
- Pagamentos antigos não são apagados nem recalculados.
- RLS atual das tabelas é preservado.

## Mudanças de banco (migração nova, aditiva)
Tabela `packages` já existe. Adições:
- `start_date text NULL` — data de início do pacote.
- `notes text DEFAULT ''` — observações.
- `payment_method text DEFAULT 'avista'` — apenas informativo.
- Status passa a aceitar: `ativo`, `futuro`, `encerrado`, `cancelado`, `pendente` (sem CHECK rígido para não quebrar dados existentes).
- Índice parcial: garantir no máximo 1 pacote `ativo` por aluno (`CREATE UNIQUE INDEX ... WHERE status='ativo'`).

Tabela `lessons` já tem `package_id`. Sem alteração estrutural.

Sem migrar dados existentes. Pacotes atuais continuam como `ativo`/`encerrado` conforme estão.

## Nova UI

### 1. Botão "Novo pacote"
Na ficha do aluno (modal de detalhes / resumo), adicionar botão **"+ Novo pacote"** ao lado de Resumo/Editar.

### 2. Modal NewPackageDialog
Campos:
- Horas contratadas (formato `8h` ou `8h30`)
- Valor do pacote
- Forma de pagamento: à vista / parcelado
- Parcelas (se parcelado)
- Data do 1º pagamento
- Desconto % (se à vista)
- Data de início do pacote
- Status inicial: ativo / futuro / pendente
- Observações

Ao salvar:
- Se já existe pacote `ativo` com horas restantes e usuário escolheu `ativo` → confirmação:
  - Criar como **futuro**
  - **Ativar agora** (pacote anterior vira `encerrado`, horas remanescentes preservadas no histórico)
  - Cancelar
- Insere novo registro em `packages` (não sobrescreve).
- Gera pagamentos vinculados ao novo `package_id`.
- `students.hours_contracted/hours_remaining` passa a refletir o pacote ativo (recalculado) — não apaga histórico.
- Log em `activity_logs` (`package_created`, `package_activated`, `package_closed`).

### 3. Seção "Histórico de pacotes"
Dentro do modal de detalhes/resumo do aluno: lista todos os pacotes ordenados por data, mostrando: nome, criado em, início, horas totais/usadas/restantes, valor, forma de pagamento, status (badge colorido). Ações por linha: Ativar (se futuro), Encerrar, Cancelar.

### 4. Encerramento automático
Quando `hours_used >= hours_total` e status `ativo` → atualizar para `encerrado` no momento em que a aula é marcada realizada/no-show (já existe lógica de consumo na Agenda — apenas adicionamos a transição de status; sem alterar o fluxo de agendamento).

### 5. Consumo correto
Aulas com `lesson_type='pacote'`: continuam consumindo, mas vinculadas ao `package_id` do pacote `ativo` no momento da criação (a Agenda já grava `package_id`). Aulas avulsas: inalteradas. Aulas antigas sem `package_id`: inalteradas.

### 6. Resumo / Portal do aluno
- Resumo do aluno: mostra pacote ativo + horas restantes + lista de histórico.
- Portal do aluno (`StudentPortal.tsx`): mostra pacote ativo (já mostra horas restantes). Adicionar histórico colapsável respeitando `view_history`.

### 7. Status do aluno
Helper `computeStudentStatus(student, packages, futureLessons)`:
- `ativo` se tem pacote ativo OU aula futura.
- `sem pacote` se não tem ativo mas tem aulas futuras avulsas.
- `inativo` apenas se nada.
Não altera campo `status` no banco automaticamente — só exibição.

## Arquivos afetados
- `supabase/migrations/<novo>.sql` — colunas + índice único parcial.
- `src/integrations/supabase/types.ts` — regenerado.
- `src/components/students/NewPackageDialog.tsx` *(novo)*.
- `src/components/students/PackageHistory.tsx` *(novo)*.
- `src/pages/Students.tsx` — botão "Novo pacote", seção histórico no modal de detalhes/resumo, helper de status.
- `src/pages/student/StudentPortal.tsx` — bloco de histórico opcional.
- `src/lib/activityLogger.ts` — reuso existente.

## Auditoria pós-implementação
Após implementar, vou rodar:
1. Query SQL: contagem de pacotes por aluno antes/depois (sem alteração nos antigos).
2. Query SQL: aulas antigas sem `package_id` (devem permanecer).
3. Query SQL: pagamentos antigos (count inalterado).
4. Verificação visual: ficha aluno, agenda, financeiro, portal.
5. Console e network limpos.
6. Relatório final com os 12 itens pedidos.

Não vou corrigir nenhum problema novo sem aprovação — apenas reportar.
