# Tutor PCPA — questões, simulados e revisão

Aplicação de estudo para a Polícia Civil do Pará, com questões autorais por IA, simulados, flashcards, caderno de revisão e Tutor.

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

- Prática, simulados e flashcards com itens autorais de IA, sempre identificados como “IA · autoral · não é real”.
- Itens de IA orientados pelo edital e por sinais agregados disponíveis de provas anteriores; nenhum enunciado real ou link de questão é exibido ou enviado ao modelo.
- Simulados com pesos do cargo ativo, cronômetro, modo foco e revisão. Os resultados são temporários e não entram nas estatísticas de questões reais.
- Flashcards com repetição espaçada local, separados por trilha.
- Estatísticas por matéria preservam somente o histórico anterior de questões reais; itens de IA não alteram esses números.
- Tutor com contexto do cargo, edital, matéria e escopo correspondentes.
- Cadastro com aprovação manual. Confirmar o código OTP comprova controle do e-mail, mas não libera o acesso.

## Política de questões e fontes

O app não exibe nem aplica enunciados integrais de provas reais em prática, simulados, flashcards ou caderno. A função antiga está aposentada no código e retorna HTTP 410; publique essa versão para substituir a função remota. O conteúdo interativo é gerado por IA, identificado em cada item e não salvo no banco oficial nem contado como desempenho real.

A IA recebe a trilha, o escopo do edital e apenas sinais agregados disponíveis — contagens e rótulos de matéria, tópico, formato e dificuldade. Não recebe enunciados, alternativas, gabaritos ou comentários de questões reais; cria itens originais e não atribui banca, concurso ou número de prova. Os sinais também respeitam a trilha: padrões de Escrivão orientam somente Escrivão e comparadores de Investigador somente Investigador. As comparações são orientação relativa, não previsão; quando não há dado comparável para a matéria e o cargo, a geração usa o edital sem inventar frequências.

Avisos de conferência legal são discretos. Quando há correspondência exata com um trecho legal previamente validado, a tela oferece o texto em um painel recolhido e um link oficial; o app não pede à IA para redigir a lei.

`supabase/data/pc-question-bank.v1.json` conserva metadados e URLs oficiais para auditoria interna, além de padrões agregados. O campo `questions` permanece vazio; a interface não apresenta catálogo, fontes, gabaritos nem links de questões. Registros históricos no banco não foram apagados, mas as telas de estudo já não carregam seus enunciados. O histórico numérico anterior continua separado dos resultados de IA.

A matriz versionada de cargos continua em `supabase/data/pcpa-study-priority-matrix.v1.json`. Ela preserva a separação entre Delegado (C-206/2020), Investigador, Escrivão e Papiloscopista (C-207/2020), com prioridades relativas, sem prometer incidência futura.

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

Para secrets, migrations, publicação das Edge Functions, SMTP e aprovação manual, consulte [`docs/CONFIGURACAO_TECNICA.md`](docs/CONFIGURACAO_TECNICA.md). A chave Gemini deve permanecer somente como secret de Edge Function no Supabase, nunca no frontend nem em arquivo versionado.

> Material de apoio. Consulte o edital aplicável, a legislação atualizada e os documentos e gabaritos oficiais.
