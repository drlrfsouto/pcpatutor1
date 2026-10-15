# Configuração do Tutor PCPA

Este guia é para quem administra a implantação do aplicativo. As instruções técnicas ficam separadas do guia de estudo dos alunos.

## Onde cadastrar as chaves

No painel do projeto Supabase, abra **Edge Functions → Secrets** e cadastre:

| Nome da secret | Valor |
|---|---|
| `GEMINI_API_KEY` | Chave principal criada no Google AI Studio; usada pelo Tutor, comentários explicativos e pela geração autoral de questões. A geração recebe apenas edital e sinais agregados, nunca enunciados reais |
| `GEMINI_API_KEY_2` | Opcional; chave de contingência, de preferência associada a outro projeto Google Cloud/AI Studio |
| `GEMINI_MODEL` | Opcional; padrão atual: `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | Opcional; padrão atual: `gemini-3.5-flash-lite` |

`GEMINI_API_KEY` é a chave principal. Se ela falhar ao iniciar uma chamada, o Tutor e as funções de questões tentam `GEMINI_API_KEY_2` e, em seguida, o modelo alternativo configurado. Cadastre `GEMINI_API_KEY_2` somente em **Edge Functions → Secrets** do Supabase; não a envie por mensagem nem a inclua em variável `VITE_*`. A chave reserva funciona melhor quando pertence a outro projeto Google Cloud/AI Studio: os limites do Gemini são por projeto, não por chave, então duas chaves do mesmo projeto compartilham a mesma cota. A contingência não aumenta nem garante limites; apenas tenta o outro projeto se a chamada falhar.

A busca e exibição de questões reais foram desativadas no app. `pcpa-gerar-questoes` agora responde HTTP 410; publique essa versão junto com o frontend para impedir o uso do endpoint antigo. A função ativa `pcpa-gerar-questoes-autorais` recebe cargo, matéria, tópico e escopo do edital, além de contagens/rótulos agregados de tópico e formato da matriz e do arquivo versionado. Ela não recebe enunciados, alternativas, gabaritos ou comentários de questões reais. Os padrões só servem como orientação relativa, não como previsão. `TAVILY_API_KEY` deixou de ser necessária para a aplicação; confirme que nenhuma função externa à aplicação a usa antes de removê-la das secrets. As Edge Functions leem as secrets no Supabase; o frontend nunca as recebe.

Também é possível cadastrá-las pela CLI, substituindo os valores entre aspas pelas suas próprias chaves:

```bash
supabase secrets set \
  GEMINI_API_KEY="SUA_CHAVE_DO_GOOGLE_AI_STUDIO" \
  GEMINI_MODEL="gemini-3.8-flash" \
  GEMINI_FALLBACK_MODEL="gemini-3.5-flash-lite"
```

Para cadastrar a chave reserva (opcional), use o painel de Secrets ou execute também:

```bash
supabase secrets set GEMINI_API_KEY_2="SUA_CHAVE_DE_CONTINGENCIA"
```

**Não envie as chaves por mensagens, não as coloque no código do frontend e não as salve em arquivos versionados.** O arquivo `.env.example` contém apenas as variáveis públicas necessárias para conectar a interface ao Supabase. A chave `SUPABASE_SERVICE_ROLE_KEY` também deve permanecer somente no ambiente seguro do Supabase.

## Qual serviço faz o quê

- **Questões reais:** a função `pcpa-gerar-questoes` está aposentada e retorna HTTP 410. O app não consulta nem exibe enunciados ou referências de questões reais.
- **Google AI Studio:** auxilia o Tutor e gera itens autorais por IA. `pcpa-gerar-questoes-autorais` recebe trilha, matéria, tópico, escopo do edital e sinais agregados de fontes versionadas. Não recebe textos de provas, alternativas, gabaritos ou justificativas. O modelo cria itens originais no padrão do app, sem atribuir banca, concurso, número ou fonte. Todo item é identificado como IA e não é salvo no banco oficial nem contado em estatísticas reais. Simulados geram itens de IA apenas para a sessão; flashcards e sua repetição espaçada ficam locais.
- **Interface de estudo:** Delegado (C-206/2020), Investigador, Escrivão e Papiloscopista (C-207/2020) mantêm matérias separadas por trilha. Nenhuma tela de prática, simulado, flashcards ou caderno carrega/enuncia questões reais ou lista links de fontes. O caderno antigo fica oculto sem apagar os registros; as estatísticas numéricas legadas continuam históricas e não recebem respostas de IA. Avisos e notas são compactos; `src/components/study/LegalReferenceNote.tsx` mostra trechos jurídicos somente quando a referência corresponde a texto previamente validado, inicialmente o art. 21 do Código Penal. O trecho abre recolhido, com link para o Planalto; a IA não redige nem atualiza o texto legal.
- **Recursos de estudo:** simulados, correção, repetição espaçada dos flashcards, estatísticas e gamificação são recursos da própria aplicação e não precisam de uma chamada de IA para funcionar.

As migrations `20261014130000_pcpa_official_questions_only.sql`, `20261014150000_pcpa_verified_answer_source.sql` e `20261014160000_pcpa_question_bank_dedup_and_reproduction_rights.sql` permanecem para proteger os registros históricos e o PostgREST. A migration `20261014170000_pcpa_study_role_sessions.sql` adiciona a trilha ativa às tentativas, erros, estados de flashcard e simulados. O frontend já não carrega enunciados reais; estatísticas legadas consultam somente identificadores, matéria e origem. Os registros no banco não são apagados. A função `pcpa-gerar-questoes` foi aposentada no código; publique sua resposta HTTP 410 para substituir a implementação antiga. Nenhuma migration nova é necessária para esta mudança. A aplicação local das migrations não faz parte do build; só aplique migrations pendentes e publique funções após autorização explícita e confirmação do projeto Supabase correto.

A interface não reproduz questões reais nem expõe referências de cadernos/gabaritos. Metadados e URLs permanecem somente em arquivos internos de auditoria; não são mostrados como catálogo ou link de questão. O app não afirma que itens de IA foram aplicados em qualquer concurso.

### Acervo de questões versionado

O arquivo canônico de metadados está em `supabase/data/pc-question-bank.v1.json`. Ele preserva referências internas de concursos, mas `questions` está vazio e `aggregate_patterns` contém apenas contagens/rótulos de matéria, tópico, formato e dificuldade; nenhum enunciado, alternativa, gabarito ou comentário acompanha a função de IA. Antes de publicar funções, execute `npm run sync:question-bank` para copiar os metadados a `supabase/functions/_shared/pc-question-bank.v1.json`. A matriz de matérias e pesos está em `supabase/data/pcpa-study-priority-matrix.v1.json`; `npm run sync:study-matrix` valida e sincroniza cargos, pesos, matérias, prioridades e evidências. O build também executa essa validação. A matriz separa os quatro cargos e suas matérias; a prioridade é relativa, não previsão. A versão atual do catálogo tem 14 referências internas e 11 padrões agregados oriundos de itens licenciados do PCDF Escrivão 2021; os itens integrais foram removidos do arquivo versionado. A Edge Function restringe esses padrões à trilha de Escrivão e os comparadores ao cargo de Investigador; Delegado e Papiloscopista usam o edital quando não há dado comparável mapeado.

Ao atualizar metadados, preserve IDs estáveis e preencha datas/cargos apenas quando comprovados. Não volte a incluir transcrições integrais, alternativas, gabaritos ou justificativas no arquivo. Atualize `aggregate_patterns` somente a partir de dados documentados, sem transformar contagens de comparadores em previsão ou peso oficial da PCPA.

A cada geração autoral, a Edge Function lê o edital e os sinais agregados versionados, sem carregar texto de questão para o prompt. A interface mostra progresso de geração; não há catálogo nem referências de questões na experiência do candidato.

A API do Google AI Studio oferece limites e cotas; não é ilimitada. Consulte as condições atuais da conta e região antes de publicar para muitos usuários.

## Acesso com código de e-mail

A tela de acesso envia um código de seis dígitos e valida o código no próprio app. Para que o e-mail contenha o código (em vez de um link), no painel do Supabase abra **Authentication → Email Templates** e use `{{ .Token }}` no corpo de **Magic link or OTP** e também de **Confirm sign up**. O primeiro cobre acessos de quem já tem conta; o segundo cobre o primeiro cadastro. Exemplo:

```html
<h2>Seu código de acesso ao Tutor PCPA</h2>
<p>Digite este código no aplicativo para confirmar seu e-mail:</p>
<p style="font-size: 24px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
<p>Se você não solicitou este código, ignore esta mensagem.</p>
```

O código chama `signInWithOtp` para enviá-lo e `verifyOtp` para validá-lo. Remova `{{ .ConfirmationURL }}` dos dois modelos; se ele continuar presente, o Supabase enviará um link. Para permitir solicitações de novos estudantes, mantenha habilitado o cadastro de novos usuários no provedor de e-mail. A confirmação do código cria uma sessão, mas o cadastro fica pendente até aprovação manual.

O provedor de e-mail padrão do Supabase é restrito a testes: sem SMTP próprio, ele só entrega mensagens a endereços autorizados da equipe do projeto e tem limite baixo de envio. Para disponibilizar o acesso aos estudantes, configure um SMTP transacional em **Authentication → SMTP Settings**. Consulte os [limites e requisitos atuais de envio](https://supabase.com/docs/guides/auth/auth-smtp).

A interface continua acessível no modo demonstração sem entrar; questões de demonstração artificiais não são mostradas no Banco de questões, nos simulados ou nos flashcards. A geração autoral por IA, a sincronização do progresso e os demais recursos protegidos exigem uma conta aprovada.

## Aprovação manual de novos cadastros

A confirmação do código valida que a pessoa controla o e-mail, mas não aprova o acesso completo. Com a migration `20261013000000_manual_access_approval.sql`, cada cadastro entra como **aguardando aprovação**. A interface mostra essa situação; dados pessoais, Tutor e geração de questões também são protegidos por RLS e pelas Edge Functions. As ferramentas públicas de demonstração continuam disponíveis após sair da conta.

Depois de aplicar a migration, a equipe administra a fila na tabela `public.pcpa_access_requests`. Para aprovar uma pessoa, abra o **SQL Editor** do projeto Supabase e execute, substituindo o e-mail:

```sql
UPDATE public.pcpa_access_requests
SET approved_at = NOW()
WHERE lower(email) = lower('estudante@exemplo.com')
RETURNING email, approved_at;
```

Para retirar a aprovação, use `SET approved_at = NULL` com o mesmo filtro por e-mail. Contas que já existiam quando a migration for aplicada também entram como pendentes. A pessoa pode clicar em **Verificar aprovação** no app após você liberar o cadastro.

## Área administrativa de aprovações

A área **Administração** aparece somente para usuários listados em `public.pcpa_admins`. A fila, a aprovação e a revogação são processadas pela Edge Function `pcpa-admin-access`, que valida a sessão e a permissão no servidor. A chave `SUPABASE_SERVICE_ROLE_KEY` nunca é enviada ao navegador.

Para configurar o primeiro administrador, confirme que a conta já existe em **Authentication → Users**, aplique a migration e publique a função administrativa. Depois abra `supabase/admin/bootstrap_admin.sql`, substitua `ADMIN_EMAIL_AQUI` pelo e-mail exato do administrador e execute o script no **SQL Editor** do projeto, usando a fonte **Primary Database**. Esse passo único cadastra a função de administrador e aprova o próprio acesso para que essa conta possa abrir o app. Não é necessário repetir SQL para aprovar os demais usuários: use os botões **Aprovar conta** e **Revogar acesso** na área administrativa.

A lista de administradores não pode ser alterada pelo frontend. Para adicionar outro administrador no futuro, o proprietário do projeto deve incluí-lo em `public.pcpa_admins` pelo painel do Supabase.

Aplique as migrations e publique as funções no projeto correto:

```bash
supabase link --project-ref <project-ref>
supabase db push
npm run sync:question-bank
npm run sync:study-matrix
supabase functions deploy pcpa-tutor
supabase functions deploy pcpa-gerar-questoes
supabase functions deploy pcpa-gerar-questoes-autorais
supabase functions deploy pcpa-admin-access
```

## Configuração do frontend e publicação

As variáveis públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` são configuradas no ambiente de publicação do frontend. O código também aceita a variável legada `VITE_SUPABASE_ANON_KEY` caso a variável de chave publicável não esteja definida. Elas não substituem as secrets acima; nunca coloque a chave Google em variáveis `VITE_*`.

Migrations, publicação das Edge Functions e demais passos de implantação dependem do projeto Supabase usado. Referências oficiais:

- [Templates de e-mail de autenticação e códigos OTP](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Configuração de SMTP para e-mails de autenticação](https://supabase.com/docs/guides/auth/auth-smtp)
- [Secrets das Supabase Edge Functions](https://supabase.com/docs/guides/functions/secrets)
- [Google AI Studio — modelos da API](https://ai.google.dev/gemini-api/docs/models)
- [Google AI Studio — preços e cotas](https://ai.google.dev/gemini-api/docs/pricing)
