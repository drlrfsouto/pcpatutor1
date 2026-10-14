# Tutor PCPA — questões, simulados e revisão

Aplicação de estudo para o concurso da Polícia Civil do Pará, com questões oficiais, prática direcionada, simulados, flashcards, caderno de erros e tutor de estudos.

## Recursos

- Banco de questões reais por matéria, tópico e dificuldade, com fontes verificadas.
- Modo autoral por IA separado, claramente identificado como não real e sem inserir itens no banco oficial.
- Prática de múltipla escolha e itens Certo/Errado.
- Simulados com cronômetro, modo foco e revisão de respostas.
- Flashcards com repetição espaçada e caderno de erros.
- Procedência exibida com concurso, banca, cargo, ano, identificação do caderno, links da prova e do gabarito e, quando comprovada, data de aplicação.
- Cadastro com aprovação manual. Confirmar o código OTP comprova controle do e-mail, mas não libera o acesso.

## Política do banco de questões

O banco oficial contém somente questões reais, com origem, gabarito e permissão de reprodução verificáveis; não se completam lacunas por inferência ou IA. O texto integral só é copiado quando há permissão explícita para fins didáticos; sem essa evidência, o catálogo guarda apenas metadados e links oficiais.

Há também um modo de prática por IA, separado do banco real. A função envia apenas matéria e tópico geral, sem textos de provas, e instrui o modelo a criar itens autorais sem copiar, reconstruir ou adaptar de perto questões específicas. Cada item é marcado como “IA · não é real”, não recebe metadados de concurso, não é salvo no banco oficial e não altera o histórico de respostas de questões reais. Como todo conteúdo de IA, confira explicações e respostas antes de memorizar.

O arquivo versionado `supabase/data/pc-question-bank.v1.json` é consultado antes da web. Se já houver questões adequadas, a busca web não é acionada. Quando necessário, a aplicação reaproveita também questões licenciadas já persistidas e pesquisa na web somente para preencher o que falta. A deduplicação usa um fingerprint estável da prova e da questão.

A versão atual do arquivo reúne 9 referências oficiais de concursos de Polícias Civis brasileiras e 11 questões integrais do PCDF Escrivão 2021, cujo documento declara permissão de reprodução didática. As outras referências permanecem como metadados e URLs; o fato de uma prova estar em site oficial não é tratado como autorização para copiar seu texto. As questões C/E mantêm as opções Certo e Errado e o gabarito oficial.

As telas de estudo mostram os links separados de prova e gabarito quando aplicável e identificam se a justificativa é oficial ou didática. Comentários não substituem o gabarito; em matéria jurídica, confira a legislação vigente.

## Matérias PCPA

1. Língua Portuguesa
2. Redação
3. Raciocínio Lógico
4. Informática
5. Direito Administrativo
6. Legislação Administrativa - Regime Jurídico Único - RJU
7. Direito Constitucional
8. Direito Penal Geral
9. Direito Processual Penal
10. Legislação Especial
11. Estatística

## Desenvolvimento

```bash
npm install
npm run dev
```

Build de validação:

```bash
npm run build
```

Para secrets, migrations, publicação das Edge Functions, SMTP e aprovação manual, consulte [`docs/CONFIGURACAO_TECNICA.md`](docs/CONFIGURACAO_TECNICA.md).

> Material de apoio. Não substitui o edital, a legislação atualizada nem os documentos e gabaritos oficiais.
