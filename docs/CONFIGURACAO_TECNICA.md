# Configuração do Tutor PCPA

Este guia é para quem administra a implantação do aplicativo. As instruções técnicas ficam separadas do guia de estudo dos alunos.

## Onde cadastrar as chaves

No painel do projeto Supabase, abra **Edge Functions → Secrets** e cadastre:

| Nome da secret | Valor |
|---|---|
| `GEMINI_API_KEY` | Chave principal criada no Google AI Studio; usada pelo Tutor e para comentários explicativos, não para criar enunciados de questões |
| `GEMINI_API_KEY_2` | Opcional; chave de contingência, de preferência associada a outro projeto Google Cloud/AI Studio |
| `TAVILY_API_KEY` | Chave da conta Tavily; necessária para localizar fontes oficiais de provas |
| `GEMINI_MODEL` | Opcional; padrão atual: `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | Opcional; padrão atual: `gemini-3.5-flash-lite` |

`GEMINI_API_KEY` é a chave principal. Se ela falhar ao iniciar uma chamada, o Tutor e a busca de questões tentam `GEMINI_API_KEY_2` e, em seguida, o modelo alternativo configurado. Cadastre `GEMINI_API_KEY_2` somente em **Edge Functions → Secrets** do Supabase; não a envie por mensagem nem a inclua em variável `VITE_*`. A chave reserva funciona melhor quando pertence a outro projeto Google Cloud/AI Studio: os limites do Gemini são por projeto, não por chave, então duas chaves do mesmo projeto compartilham a mesma cota. A contingência não aumenta nem garante limites; apenas tenta o outro projeto se a chamada falhar.

`TAVILY_API_KEY` é necessária para pesquisar provas e gabaritos em fontes primárias oficiais. Se a busca não estiver configurada ou não encontrar evidência suficiente, o sistema não cria nem insere questões como substitutas. Os nomes dos modelos são opcionais porque o código já tem padrões. As Edge Functions leem as chaves com segurança no Supabase; o frontend nunca as recebe.

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
- **Google AI Studio:** auxilia o Tutor e estrutura o comentário explicativo a partir das fontes encontradas. Não cria nem completa enunciados ou alternativas. Uma questão só é salva quando um documento oficial comprova literalmente o enunciado e as cinco alternativas e um documento oficial comprova o gabarito para a mesma questão. Os documentos podem ser o mesmo ou separados; quando separados, ambos precisam comprovar o mesmo concurso, banca, cargo, ano e número da questão. Os links da prova e do gabarito ficam registrados separadamente. A data da prova só é guardada quando aparece explicitamente no documento da prova. Se a verificação falhar, a questão é descartada — não há preenchimento por IA.
- **Interface de estudo:** prática, simulados, flashcards e caderno de erros filtram itens cuja origem e gabarito oficial não passam pela validação de procedência. O comentário de resolução pode usar IA e deve ser conferido no documento original.
- **Recursos de estudo:** simulados, correção, repetição espaçada dos flashcards, estatísticas e gamificação são recursos da própria aplicação e não precisam de uma chamada de IA para funcionar.

As migrations `20261014130000_pcpa_official_questions_only.sql` e `20261014150000_pcpa_verified_answer_source.sql` restringem também o acesso pelo PostgREST: registros antigos de IA, manuais ou sem procedência completa não são apagados, mas deixam de ser legíveis por contas anônimas e autenticadas. Quando houver um `url_gabarito` separado, ele também precisa apontar para um domínio oficial aprovado. A Edge Function com `service_role` continua podendo inserir itens verificados. Para publicar essas mudanças, execute `supabase db push` no projeto correto.

Antes de disponibilizar questões na aplicação, confirme que os termos da banca ou do órgão permitem a reprodução e redistribuição do texto da prova. O fato de a prova estar em um site oficial não significa, por si só, que o conteúdo esteja livre de direitos autorais; quando necessário, prefira exibir a referência e o link para a fonte.

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
supabase functions deploy pcpa-tutor
supabase functions deploy pcpa-gerar-questoes
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
