# Configuração do Tutor PCPA

Este guia é para quem administra a implantação do aplicativo. As instruções técnicas ficam separadas do guia de estudo dos alunos.

## Onde cadastrar as chaves

No painel do projeto Supabase, abra **Edge Functions → Secrets** e cadastre:

| Nome da secret | Valor |
|---|---|
| `GEMINI_API_KEY` | Chave criada no Google AI Studio |
| `TAVILY_API_KEY` | Chave da conta Tavily |
| `GEMINI_MODEL` | Opcional; padrão atual: `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | Opcional; padrão atual: `gemini-3.5-flash-lite` |

`GEMINI_API_KEY` é usada pelo Tutor e pela geração de questões inéditas. `TAVILY_API_KEY` habilita a busca web de questões reais; sem ela, a geração pode continuar, mas os novos itens devem ser identificados como gerados por IA. Os nomes dos modelos são opcionais porque o código já tem padrões. Após salvar as secrets no Supabase, as Edge Functions podem lê-las sem que sejam incluídas no aplicativo do aluno. Pelo painel, não é necessário publicar as funções novamente; a alteração fica disponível para elas.

Também é possível cadastrá-las pela CLI, substituindo os valores entre aspas pelas suas próprias chaves:

```bash
supabase secrets set \
  GEMINI_API_KEY="SUA_CHAVE_DO_GOOGLE_AI_STUDIO" \
  TAVILY_API_KEY="SUA_CHAVE_TAVILY" \
  GEMINI_MODEL="gemini-3.8-flash" \
  GEMINI_FALLBACK_MODEL="gemini-3.5-flash-lite"
```

**Não envie as chaves por mensagens, não as coloque no código do frontend e não as salve em arquivos versionados.** O arquivo `.env.example` contém apenas as variáveis públicas necessárias para conectar a interface ao Supabase. A chave `SUPABASE_SERVICE_ROLE_KEY` também deve permanecer somente no ambiente seguro do Supabase.

## Qual serviço faz o quê

- **Tavily:** pesquisa páginas na web para localizar questões de concursos e material de referência. Não cria nem valida respostas por conta própria.
- **Google AI Studio:** fornece a geração de texto usada pelo Tutor e pela criação de questões inéditas. Na pesquisa de questões, recebe os resultados encontrados para estruturar o material; a aplicação só mantém a etiqueta **Questão real** quando o conteúdo da fonte comprova o enunciado, as cinco alternativas, os dados da prova e o gabarito. Sem evidência suficiente, a questão é marcada como **Gerada por IA**.
- **Recursos de estudo:** simulados, correção, repetição espaçada dos flashcards, estatísticas e gamificação são recursos da própria aplicação e não precisam de uma chamada de IA para funcionar.

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

As ferramentas de estudo continuam acessíveis no modo demonstração sem entrar. Uma conta autenticada só sincroniza progresso e usa recursos protegidos depois da aprovação.

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
