# Tutor PCPA — questões, simulados e revisão

Aplicação de estudo para a Polícia Civil do Pará, com geração unificada de questões reais verificáveis e itens autorais por IA, simulados, flashcards, caderno de erros e Tutor.

## Trilhas por cargo

A interface mantém uma trilha ativa por vez e a persiste neste dispositivo. Matérias, pesos, seletores, questões, simulados, flashcards, estatísticas, caderno de erros e contexto do Tutor são filtrados pelo cargo. Tentativas, cartões, erros e simulados novos também recebem o identificador da trilha no banco.

| Cargo | Edital histórico | Matérias | Prova objetiva |
|---|---:|---:|---:|
| Delegado | C-206/2020 | 14 | 80 questões / 10 pontos |
| Investigador | C-207/2020 | 11 | 60 questões / 10 pontos |
| Escrivão | C-207/2020 | 11 | 60 questões / 10 pontos |
| Papiloscopista | C-207/2020 | 13 | 60 questões / 10 pontos |

A matriz versionada está em `supabase/data/pcpa-study-priority-matrix.v1.json`. Prioridades alta, média e base decorrem do peso oficial de cada matéria; a ordem dos tópicos é orientação relativa, não previsão de incidência. O Anexo II e as tabelas 9.1–9.3 do C-207/2020 foram conferidos na [edição oficial do DOE nº 34.405, publicada pela IOEPA em 13/11/2020](https://www.ioepa.com.br/pages/2020/2020.11.13.DOE.pdf); as distribuições também foram cotejadas com a versão oficial retificada do Instituto AOCP. C-206/2020 e C-207/2020 são editais históricos e não substituem um edital futuro.

## Recursos

- Banco de questões reais por matéria, tópico e dificuldade, com origem, gabarito, links e permissão de reprodução verificáveis.
- Um único fluxo na prática dirigida: busca questões reais verificadas primeiro e usa itens autorais de IA apenas para completar a quantidade solicitada, sem excedê-la. A origem é identificada junto a cada questão; itens de IA não entram no banco oficial, nas estatísticas reais nem no caderno de erros.
- Simulados com pesos do cargo ativo, cronômetro, modo foco e revisão de respostas; o simulado nunca completa o acervo com itens de IA.
- Flashcards com repetição espaçada e caderno de erros separados por trilha.
- Estatísticas e progresso por matéria dentro da trilha selecionada.
- Tutor com contexto do cargo, edital, matéria e escopo correspondentes.
- Cadastro com aprovação manual. Confirmar o código OTP comprova controle do e-mail, mas não libera o acesso.

## Política do banco de questões

O banco oficial contém somente questões reais com origem, gabarito e permissão de reprodução verificáveis; não se completam lacunas por inferência ou IA. O texto integral só é copiado quando há permissão explícita para fins didáticos; sem essa evidência, o sistema mantém internamente apenas metadados e links oficiais, sem exibir um catálogo independente na prática dirigida.

Na prática dirigida há um único fluxo: questões reais com origem, gabarito e permissão verificados são buscadas primeiro; itens autorais de IA aparecem na mesma sequência apenas para completar a quantidade solicitada, sem excedê-la. Cada questão mostra sua procedência e referências oficiais somente junto ao item correspondente. A função recebe cargo, matéria e tópico do edital — nunca texto de prova — e instrui o modelo a não copiar, reconstruir nem adaptar de perto questões específicas. Itens de IA são marcados como “IA · não é real”, não recebem metadados de concurso, não são salvos no banco oficial e não alteram estatísticas ou caderno de erros reais. Simulados continuam usando apenas questões reais verificadas. Como todo conteúdo de IA, confira explicações e respostas antes de memorizar.

O arquivo versionado `supabase/data/pc-question-bank.v1.json` é consultado antes da web. Se já houver questões adequadas, a busca web não é acionada. Quando necessário, a aplicação reaproveita também questões licenciadas já persistidas e pesquisa na web para preencher lacunas. A deduplicação usa um fingerprint estável da prova e da questão. A busca exibe progresso durante a consulta.

A versão atual do arquivo reúne referências de concursos de Polícias Civis brasileiras e 11 questões integrais do PCDF Escrivão 2021, cujo documento declara permissão de reprodução didática. As outras referências permanecem como metadados e URLs internos e só são exibidas junto à questão correspondente; o fato de uma prova estar em site oficial não é tratado como autorização para copiar seu texto. As questões C/E mantêm as opções Certo e Errado e o gabarito oficial.

## Banco de dados e desenvolvimento

As migrações mais recentes acrescentam `study_role_id` às tentativas, caderno de erros, flashcards e simulados para manter o histórico separado por trilha. Antes de publicar a interface/Edge Functions atualizadas em um projeto Supabase, aplique todas as migrations pendentes — inclusive `20261014170000_pcpa_study_role_sessions.sql` — e publique as funções. **Nenhum deploy é feito automaticamente por este repositório.**

```bash
npm ci
npm run dev
```

Build de validação (valida e sincroniza a matriz antes de compilar):

```bash
npm run build
```

Para secrets, migrations, publicação das Edge Functions, SMTP e aprovação manual, consulte [`docs/CONFIGURACAO_TECNICA.md`](docs/CONFIGURACAO_TECNICA.md). Chaves do Gemini e Tavily devem permanecer somente como secrets de Edge Functions no Supabase, nunca no frontend nem em arquivos versionados.

> Material de apoio. Consulte o edital aplicável, a legislação atualizada e os documentos e gabaritos oficiais.
