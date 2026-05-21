# Nova Agenda Operacional do OneTeacher

Transformar a aba 'Agenda' em uma central operacional completa.

## 1. Componentes
- Criar novo layout na `Agenda.tsx` com divisões para calendário (topo), resumo do dia (cards), próximas aulas (lista) e painel lateral.
- Nova interface `OperationalAgenda`:
  - `SummaryCards`: Exibe aulas, horas, alunos, avulsas, pendentes e atrasos.
  - `UpcomingLessonsList`: Lista vertical com ordenação, filtros de status e tipo.
  - `CalendarView`: Calendário mensal modernizado com status colorido.
  - `InsightsPanel` (Sidebar): Próximas 3 aulas, métricas rápidas e alertas.

## 2. Lógica e Dados
- `loadOperationalStats`: Função para calcular métricas em tempo real (aulas, horas, avulsas, etc).
- `filters`: Implementar estados para filtragem rápida.
- `alerts`: Lógica para exibir avisos (pacotes acabando, pendentes).

## 3. Visual
- Design premium seguindo `card-premium` e estilo atual.
- Microanimações de transição entre visualizações.
- Responsividade ajustada para mobile/tablet/desktop.

## 4. Ordem de Implementação
1. Refatoração estrutural da `Agenda.tsx`.
2. Implementação da nova seção de resumo operacional.
3. Modernização do calendário visual.
4. Implementação de filtros e busca.
5. Painel lateral informativo.
6. Ajustes de responsividade e loading.

Não haverá alteração no banco de dados ou autenticação, apenas consumo de dados existentes.
