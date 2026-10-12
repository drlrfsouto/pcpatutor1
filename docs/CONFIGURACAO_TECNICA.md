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

A tela de acesso envia um código de seis dígitos e valida o código no próprio app. Para que o e-mail contenha o código (em vez de um link), no painel do Supabase abra **Authentication → Email Templates → Magic Link** e use `{{ .Token }}` no corpo do e-mail. Exemplo:

```html
<h2>Seu código de acesso ao Tutor PCPA</h2>
<p>Digite este código no aplicativo para confirmar seu e-mail:</p>
<p style="font-size: 24px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
<p>Se você não solicitou este código, ignore esta mensagem.</p>
```

O código chama `signInWithOtp` para enviá-lo e `verifyOtp` para validá-lo. Se o template continuar usando `{{ .ConfirmationURL }}`, o Supabase enviará um link e a caixa de seis dígitos do app não poderá validá-lo. Para permitir que novos estudantes criem uma conta ao informar o e-mail, mantenha habilitado o cadastro de novos usuários no provedor de e-mail.

O provedor de e-mail padrão do Supabase é restrito a testes: sem SMTP próprio, ele só entrega mensagens a endereços autorizados da equipe do projeto e tem limite baixo de envio. Para disponibilizar o acesso aos estudantes, configure um SMTP transacional em **Authentication → SMTP Settings**. Consulte os [limites e requisitos atuais de envio](https://supabase.com/docs/guides/auth/auth-smtp).

As ferramentas de estudo continuam acessíveis no modo demonstração sem entrar. Confirmar o e-mail cria a sessão para sincronização do progresso e para recursos que exigem autenticação.

## Configuração do frontend e publicação

As variáveis públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` são configuradas no ambiente de publicação do frontend. O código também aceita a variável legada `VITE_SUPABASE_ANON_KEY` caso a variável de chave publicável não esteja definida. Elas não substituem as secrets acima; nunca coloque as chaves Tavily ou Google em variáveis `VITE_*`.

Migrations, publicação das Edge Functions e demais passos de implantação dependem do projeto Supabase usado. Referências oficiais:

- [Templates de e-mail de autenticação e códigos OTP](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Configuração de SMTP para e-mails de autenticação](https://supabase.com/docs/guides/auth/auth-smtp)
- [Secrets das Supabase Edge Functions](https://supabase.com/docs/guides/functions/secrets)
- [Google AI Studio — modelos da API](https://ai.google.dev/gemini-api/docs/models)
- [Google AI Studio — preços e cotas](https://ai.google.dev/gemini-api/docs/pricing)
- [Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search)
