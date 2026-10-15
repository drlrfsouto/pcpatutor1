# Configuração do Tutor PCPA

Este guia é para quem administra a implantação do aplicativo. As instruções técnicas ficam separadas do guia de estudo dos alunos.

## Onde cadastrar as chaves

No painel do projeto Supabase, abra **Edge Functions → Secrets** e cadastre:

| Nome da secret | Valor |
|---|---|
| `GEMINI_API_KEY` | Chave principal criada no Google AI Studio; usada pelo Tutor, comentários explicativos e pela geração de itens autorais que completam a prática unificada. Nunca é usada para criar, alterar ou completar o conteúdo de questões reais |
| `GEMINI_API_KEY_2` | Opcional; chave de contingência, de preferência associada a outro projeto Google Cloud/AI Studio |
| `TAVILY_API_KEY` | Secret da conta Tavily; usada somente para buscar novas fontes quando o acervo local não cobrir a solicitação |
| `GEMINI_MODEL` | Opcional; padrão atual: `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | Opcional; padrão atual: `gemini-3.5-flash-lite` |

`GEMINI_API_KEY` é a chave principal. Se ela falhar ao iniciar uma chamada, o Tutor e as funções de questões tentam `GEMINI_API_KEY_2` e, em seguida, o modelo alternativo configurado. Cadastre `GEMINI_API_KEY_2` somente em **Edge Functions → Secrets** do Supabase; não a envie por mensagem nem a inclua em variável `VITE_*`. A chave reserva funciona melhor quando pertence a outro projeto Google Cloud/AI Studio: os limites do Gemini são por projeto, não por chave, então duas chaves do mesmo projeto compartilham a mesma cota. A contingência não aumenta nem garante limites; apenas tenta o outro projeto se a chamada falhar.

`TAVILY_API_KEY` é necessária somente quando o acervo local versionado e as questões licenciadas já persistidas não forem suficientes e a função precisar pesquisar itens novos. A função de busca real consulta primeiro `supabase/data/pc-question-bank.v1.json`, depois reaproveita registros elegíveis do banco e só então chama a web para preencher lacunas. Ela não cria questões substitutas: retorna apenas questões reais que passaram pelas verificações. No fluxo único da prática, se ainda faltar a quantidade solicitada, a função autoral recebe cargo, matéria e tópico — nunca enunciados de prova — e pode gerar itens originais identificados como IA. Os nomes dos modelos são opcionais porque o código já tem padrões. As Edge Functions leem as secrets no Supabase; o frontend nunca as recebe.

Também é possível cadastrá-las pela CLI, substituindo os valores entre aspas pelas suas próprias chaves:

```bash
supabase secrets set \
  GEMINI_API_KEY="SUA_CHAVE_DO_GOOGLE_AI_STUDIO" \
  TAVILY_API_KEY="SUA_CHAVE_TAVILY" \
  GEMINI_MODEL="gemini-3.8-flash" \
  GEMINI_FALLBACK_MODEL="gemini-3.5-flash-lite"
```

Para cadastrar a chave reserva (opcional), use o painel de Secrets ou execute também:

```bash
supabase secrets set GEMINI_API_KEY_2="SUA_CHAVE_DE_CONTINGENCIA"
```

**Não envie as chaves por mensagens, não as coloque no código do frontend e não as salve em arquivos versionados.** O arquivo `.env.example` contém apenas as variáveis públicas necessárias para conectar a interface ao Supabase. A chave `SUPABASE_SERVICE_ROLE_KEY` também deve permanecer somente no ambiente seguro do Supabase.

## Qual serviço faz o quê

- **Tavily:** pesquisa páginas na web para localizar provas e gabaritos. Os resultados precisam vir de um domínio de banca organizadora ou órgão público aceito pela lista de fontes primárias da Edge Function.
- **Google AI Studio:** auxilia o Tutor e estrutura comentários didáticos. O endpoint `pcpa-gerar-questoes-autorais` recebe o cargo/trilha ativa, a matéria, o tópico e o escopo da matriz versionada, sem texto de provas ou questões específicas, e instrui o modelo a criar itens originais sem copiar, reconstruir ou adaptar de perto questões existentes. Na prática dirigida há um único fluxo: a busca real é executada primeiro e itens de IA aparecem na mesma sequência apenas para completar a quantidade solicitada, sem excedê-la. Cada item é marcado como “IA · não é real”, não recebe metadados de concurso, não é salvo no banco oficial e não entra nas estatísticas ou no caderno de erros reais. A IA não altera nem substitui enunciados, alternativas, gabaritos ou metadados de questões reais. Simulados continuam sem preenchimento por IA. A extração integral de questão real só é aceita quando a prova oficial traz permissão explícita de reprodução didática ou licença equivalente identificada. Questões de múltipla escolha precisam ter o enunciado e as cinco alternativas literais; itens de julgamento aceitam o formato C/E com as opções padronizadas `Certo` e `Errado`. Um documento oficial deve comprovar o gabarito para o mesmo número, concurso, banca, cargo e ano; caderno identificado precisa corresponder nos documentos envolvidos. Os links da prova e do gabarito são armazenados separadamente. Metadados incompletos ou sem permissão não são preenchidos por IA.
- **Interface de estudo:** a trilha ativa é selecionada entre Delegado (C-206/2020), Investigador, Escrivão e Papiloscopista (C-207/2020). Banco, simulados, flashcards, caderno, estatísticas e Tutor usam apenas matérias da trilha; novas tentativas, cartões, erros e simulados recebem `study_role_id`. A prática dirigida tem um único fluxo: consulta questões reais verificadas primeiro e usa itens originais de IA só para preencher a quantidade que faltar, sem excedê-la. A origem e as referências de cada item são apresentadas somente junto à questão correspondente. Respostas de IA não são registradas como desempenho real nem vão ao Banco oficial, às estatísticas ou ao caderno; simulados usam apenas questões reais. A procedência de itens reais apresenta links da prova, do gabarito e da evidência da permissão; o comentário é identificado como oficial ou didático assistido por IA.
- **Recursos de estudo:** simulados, correção, repetição espaçada dos flashcards, estatísticas e gamificação são recursos da própria aplicação e não precisam de uma chamada de IA para funcionar.

As migrations `20261014130000_pcpa_official_questions_only.sql`, `20261014150000_pcpa_verified_answer_source.sql` e `20261014160000_pcpa_question_bank_dedup_and_reproduction_rights.sql` restringem o PostgREST a questões reais com procedência oficial e permissão expressa de reprodução. A migration `20261014170000_pcpa_study_role_sessions.sql` adiciona a trilha ativa às tentativas, erros, estados de flashcard e simulados, com índices exclusivos por cargo para manter históricos separados. Registros antigos de IA, manuais ou sem permissão/metadados completos não são apagados, mas deixam de ser legíveis por contas anônimas e autenticadas. Prova, gabarito e evidência de licença precisam apontar para domínios oficiais aprovados. A última migration também cria um fingerprint único, usado para impedir duplicatas nas importações locais e na pesquisa web. A Edge Function com `service_role` consulta, persiste e reutiliza itens elegíveis. A aplicação local destas migrations não faz parte do build. Só aplique-as e publique as Edge Functions após autorização explícita e confirmação do projeto Supabase correto; então execute `supabase db push`.

Antes de disponibilizar questões na aplicação, confirme que os termos da banca ou do órgão permitem a reprodução e redistribuição do texto da prova. O fato de a prova estar em um site oficial não significa, por si só, que o conteúdo esteja livre de direitos autorais; quando necessário, prefira exibir a referência e o link para a fonte.

### Acervo de questões versionado

O arquivo canônico do catálogo está em `supabase/data/pc-question-bank.v1.json`. Antes de publicar a Edge Function, execute `npm run sync:question-bank`: o comando copia esse arquivo para `supabase/functions/_shared/pc-question-bank.v1.json`, caminho empacotado com a função. A matriz de matérias e pesos está em `supabase/data/pcpa-study-priority-matrix.v1.json`; `npm run sync:study-matrix` valida cargos, pesos, matérias, prioridades e IDs de evidência e a copia para `supabase/functions/_shared/pcpa-study-priority-matrix.v1.json`. O build também executa essa validação/sincronização. O Anexo II do C-207/2020 foi conferido na publicação primária do [DOE nº 34.405 no portal da IOEPA](https://www.ioepa.com.br/pages/2020/2020.11.13.DOE.pdf); as Tabelas 9.1–9.3 de distribuição foram também cotejadas com a versão oficial retificada do Instituto AOCP. A matriz registra as quantidades, os pesos e os escopos separados dos três cargos do edital histórico. `exam_sources` guarda referências de concursos de Polícias Civis; `questions` contém transcrição integral apenas quando a permissão foi verificada. As catorze referências da versão atual incluem onze itens licenciados do PCDF Escrivão 2021; os demais concursos permanecem como metadados e links oficiais. Questões anuladas não são importadas.

Ao atualizar o arquivo, preserve os IDs estáveis e só acrescente texto quando houver evidência explícita da licença/permissão no documento oficial. Registre URLs distintas para prova e gabarito quando forem documentos separados; não associe cadernos diferentes. Preencha datas e cargos apenas quando comprovados e mantenha `subject`, `topic` e `difficulty` identificados como classificações editoriais. O tipo `certo_errado` usa duas opções (`Certo`, `Errado`) e `official_answer_letter` deve corresponder ao gabarito oficial. Não crie enunciados, gabaritos, justificativas ou metadados por inferência.

A cada solicitação, a função verifica o arquivo versionado, reaproveita questões licenciadas já no banco e só pesquisa a web se ainda faltar a quantidade solicitada. A interface mostra o progresso da busca; não há catálogo independente de fontes. A falta de permissão impede a transcrição integral, e referências oficiais eventualmente exibidas permanecem somente junto à questão correspondente.

A API do Google AI Studio oferece uma faixa gratuita com limites e cotas; ela não é ilimitada. Consulte as condições atuais da sua conta e região antes de publicar para muitos usuários. Consulte também os limites vigentes da Tavily.

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

A interface continua acessível no modo demonstração sem entrar; questões de demonstração artificiais não são mostradas no Banco de questões, nos simulados ou nos flashcards. A busca de questões oficiais, a sincronização do progresso e os demais recursos protegidos exigem uma conta aprovada.

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

As variáveis públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` são configuradas no ambiente de publicação do frontend. O código também aceita a variável legada `VITE_SUPABASE_ANON_KEY` caso a variável de chave publicável não esteja definida. Elas não substituem as secrets acima; nunca coloque as chaves Tavily ou Google em variáveis `VITE_*`.

Migrations, publicação das Edge Functions e demais passos de implantação dependem do projeto Supabase usado. Referências oficiais:

- [Templates de e-mail de autenticação e códigos OTP](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Configuração de SMTP para e-mails de autenticação](https://supabase.com/docs/guides/auth/auth-smtp)
- [Secrets das Supabase Edge Functions](https://supabase.com/docs/guides/functions/secrets)
- [Google AI Studio — modelos da API](https://ai.google.dev/gemini-api/docs/models)
- [Google AI Studio — preços e cotas](https://ai.google.dev/gemini-api/docs/pricing)
- [Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search)
