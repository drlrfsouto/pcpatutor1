-- ============================================================================
-- MIGRATION: Sistema PCPA com questões reais, caderno de erros e gamificação
-- ============================================================================

-- 1. Metadados de origem. A aplicação só rotula uma questão como real quando
--    existe fonte aterrada pela busca, banca, ano e gabarito oficial verificável.
ALTER TABLE public.pcpa_questions
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.pcpa_questions.metadata IS
'Metadados da origem. Para concurso_real: concurso, banca, cargo, ano, url_fonte, gabarito_oficial e numero_questao. Questões de IA/manual devem usar objeto vazio.';

-- Normalização conservadora de valores legados mais comuns antes de instalar
-- as constraints. Valores desconhecidos não são reescritos silenciosamente.
UPDATE public.pcpa_questions
SET source = CASE lower(trim(source))
  WHEN 'ia' THEN 'ai_generated'
  WHEN 'ai_generated' THEN 'ai_generated'
  WHEN 'gerada_por_ia' THEN 'ai_generated'
  WHEN 'gerado_por_ia' THEN 'ai_generated'
  WHEN 'real' THEN 'concurso_real'
  WHEN 'concurso' THEN 'concurso_real'
  WHEN 'concurso_real' THEN 'concurso_real'
  WHEN 'questao_real' THEN 'concurso_real'
  WHEN 'manual' THEN 'manual'
  ELSE source
END
WHERE source IS NOT NULL;

UPDATE public.pcpa_questions
SET source = 'manual'
WHERE source IS NULL OR trim(source) = '';

ALTER TABLE public.pcpa_questions ALTER COLUMN source SET DEFAULT 'manual';
ALTER TABLE public.pcpa_questions ALTER COLUMN source SET NOT NULL;
ALTER TABLE public.pcpa_questions ALTER COLUMN subject SET NOT NULL;

UPDATE public.pcpa_questions
SET subject = CASE lower(trim(subject))
  WHEN 'português' THEN 'Língua Portuguesa'
  WHEN 'lingua portuguesa' THEN 'Língua Portuguesa'
  WHEN 'raciocínio lógico-matemático' THEN 'Raciocínio Lógico'
  WHEN 'raciocinio logico' THEN 'Raciocínio Lógico'
  WHEN 'informática' THEN 'Informática'
  WHEN 'direito penal' THEN 'Direito Penal Geral'
  WHEN 'processo penal' THEN 'Direito Processual Penal'
  WHEN 'direito processual penal' THEN 'Direito Processual Penal'
  WHEN 'rju' THEN 'Legislação Administrativa - Regime Jurídico Único - RJU'
  WHEN 'legislação administrativa - rju' THEN 'Legislação Administrativa - Regime Jurídico Único - RJU'
  ELSE subject
END
WHERE subject IS NOT NULL;

-- 2. Índices para busca e relatórios.
CREATE INDEX IF NOT EXISTS idx_questions_source ON public.pcpa_questions(source);
CREATE INDEX IF NOT EXISTS idx_questions_metadata ON public.pcpa_questions USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_questions_subject_topic ON public.pcpa_questions(subject, topic);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.pcpa_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_created ON public.pcpa_questions(created_at DESC);

-- 3. Origem permitida para cada questão.
ALTER TABLE public.pcpa_questions DROP CONSTRAINT IF EXISTS valid_source;
ALTER TABLE public.pcpa_questions
  ADD CONSTRAINT valid_source
  CHECK (source IN ('ai_generated', 'concurso_real', 'manual'));

-- 4. Nomes canônicos das 11 matérias oficiais. Dados legados fora desta lista
--    devem ser mapeados antes da migração; não são apagados ou renomeados por chute.
ALTER TABLE public.pcpa_questions DROP CONSTRAINT IF EXISTS valid_subject;
ALTER TABLE public.pcpa_questions
  ADD CONSTRAINT valid_subject
  CHECK (subject IN (
    'Língua Portuguesa',
    'Redação',
    'Raciocínio Lógico',
    'Informática',
    'Direito Administrativo',
    'Legislação Administrativa - Regime Jurídico Único - RJU',
    'Direito Constitucional',
    'Direito Penal Geral',
    'Direito Processual Penal',
    'Legislação Especial',
    'Estatística'
  ));

-- 5. Estatísticas globais por questão.
ALTER TABLE public.pcpa_questions
  ADD COLUMN IF NOT EXISTS times_answered INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times_correct INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difficulty_rating DOUBLE PRECISION;

COMMENT ON COLUMN public.pcpa_questions.difficulty_rating IS
'Proporção acumulada de respostas corretas (0.0 = muito difícil; 1.0 = muito fácil).';

-- 6. Caderno de erros. Unicidade por usuário/questão mantém uma única ficha
--    ativa, atualizada automaticamente em tentativas incorretas posteriores.
CREATE TABLE IF NOT EXISTS public.pcpa_wrong_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.pcpa_questions(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES public.pcpa_attempts(id) ON DELETE SET NULL,
  wrong_answer TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  mastered BOOLEAN NOT NULL DEFAULT FALSE,
  review_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wrong_answers_user ON public.pcpa_wrong_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_wrong_answers_question ON public.pcpa_wrong_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_wrong_answers_reviewed ON public.pcpa_wrong_answers(user_id, reviewed);
CREATE INDEX IF NOT EXISTS idx_wrong_answers_mastered ON public.pcpa_wrong_answers(user_id, mastered);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wrong_answers_user_question
  ON public.pcpa_wrong_answers(user_id, question_id);

COMMENT ON TABLE public.pcpa_wrong_answers IS
'Caderno de erros: registra automaticamente questões respondidas incorretamente para revisão individual.';

ALTER TABLE public.pcpa_wrong_answers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcpa_wrong_answers TO authenticated;
DROP POLICY IF EXISTS "Users view own wrong answers" ON public.pcpa_wrong_answers;
CREATE POLICY "Users view own wrong answers"
  ON public.pcpa_wrong_answers FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own wrong answers" ON public.pcpa_wrong_answers;
CREATE POLICY "Users insert own wrong answers"
  ON public.pcpa_wrong_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own wrong answers" ON public.pcpa_wrong_answers;
CREATE POLICY "Users update own wrong answers"
  ON public.pcpa_wrong_answers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own wrong answers" ON public.pcpa_wrong_answers;
CREATE POLICY "Users delete own wrong answers"
  ON public.pcpa_wrong_answers FOR DELETE USING (auth.uid() = user_id);

-- 7. Referências legais: leitura pública, manutenção apenas pelo backend.
CREATE TABLE IF NOT EXISTS public.pcpa_legal_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_name TEXT NOT NULL,
  law_code TEXT NOT NULL,
  article_number TEXT NOT NULL,
  full_text TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  category TEXT,
  last_updated DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_ref_code ON public.pcpa_legal_references(law_code);
CREATE INDEX IF NOT EXISTS idx_legal_ref_article ON public.pcpa_legal_references(article_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_ref_code_article
  ON public.pcpa_legal_references(law_code, article_number);

COMMENT ON TABLE public.pcpa_legal_references IS
'Biblioteca de referências legais. O texto consolidado deve ser conferido no portal oficial antes de uso em prova.';

ALTER TABLE public.pcpa_legal_references ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.pcpa_legal_references TO anon, authenticated;
DROP POLICY IF EXISTS "Legal references are readable by everyone" ON public.pcpa_legal_references;
CREATE POLICY "Legal references are readable by everyone"
  ON public.pcpa_legal_references FOR SELECT USING (TRUE);

-- Trecho do caput (não substitui a leitura do artigo consolidado).
INSERT INTO public.pcpa_legal_references
  (law_name, law_code, article_number, full_text, summary, category, url)
VALUES
  (
    'Constituição da República Federativa do Brasil',
    'CF/88',
    'Art. 144, caput',
    'Art. 144. A segurança pública, dever do Estado, direito e responsabilidade de todos, é exercida para a preservação da ordem pública e da incolumidade das pessoas e do patrimônio.',
    'Trecho do caput sobre o dever estatal e a finalidade da segurança pública. Consulte o texto constitucional consolidado para ver a redação vigente e os incisos.',
    'Direito Constitucional',
    'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm'
  )
ON CONFLICT (law_code, article_number) DO NOTHING;

-- 8. Sequência de estudos e contadores gerais.
CREATE TABLE IF NOT EXISTS public.pcpa_study_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_study_date DATE,
  total_study_days INTEGER NOT NULL DEFAULT 0,
  total_questions_answered INTEGER NOT NULL DEFAULT 0,
  total_correct_answers INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streaks_user ON public.pcpa_study_streaks(user_id);
COMMENT ON TABLE public.pcpa_study_streaks IS
'Gamificação e estatísticas: sequência diária, dias ativos e totais de questões.';

ALTER TABLE public.pcpa_study_streaks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.pcpa_study_streaks TO authenticated;
DROP POLICY IF EXISTS "Users view own streaks" ON public.pcpa_study_streaks;
CREATE POLICY "Users view own streaks" ON public.pcpa_study_streaks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own streaks" ON public.pcpa_study_streaks;
CREATE POLICY "Users insert own streaks" ON public.pcpa_study_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own streaks" ON public.pcpa_study_streaks;
CREATE POLICY "Users update own streaks" ON public.pcpa_study_streaks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. Compatibilidade com projetos que ainda não tinham as colunas recentes.
ALTER TABLE public.pcpa_attempts
  ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence_level INTEGER;
ALTER TABLE public.pcpa_attempts DROP CONSTRAINT IF EXISTS pcpa_attempts_confidence_level_check;
ALTER TABLE public.pcpa_attempts
  ADD CONSTRAINT pcpa_attempts_confidence_level_check
  CHECK (confidence_level IS NULL OR confidence_level BETWEEN 1 AND 5);

ALTER TABLE public.pcpa_simulados
  ADD COLUMN IF NOT EXISTS timer_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS focus_mode BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.pcpa_flashcard_state
  ADD COLUMN IF NOT EXISTS ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS repetitions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interval_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_review_date TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcard_state_user_question
  ON public.pcpa_flashcard_state(user_id, question_id);

-- 10. Estatísticas de questão: valores calculados com os novos totais, sem erro
--     de uma tentativa por causa da ordem de avaliação de SET.
CREATE OR REPLACE FUNCTION public.update_question_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pcpa_questions
  SET
    times_answered = COALESCE(times_answered, 0) + 1,
    times_correct = COALESCE(times_correct, 0) + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
    difficulty_rating =
      (COALESCE(times_correct, 0) + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END)::DOUBLE PRECISION
      / NULLIF(COALESCE(times_answered, 0) + 1, 0)
  WHERE id = NEW.question_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_question_stats ON public.pcpa_attempts;
CREATE TRIGGER trigger_update_question_stats
AFTER INSERT ON public.pcpa_attempts
FOR EACH ROW EXECUTE FUNCTION public.update_question_stats();

-- 11. Atualiza a sequência no máximo uma vez por data, mas contabiliza cada
--     tentativa nos acumuladores. A operação UPSERT é segura em chamadas simultâneas.
CREATE OR REPLACE FUNCTION public.update_study_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  INSERT INTO public.pcpa_study_streaks AS streak (
    user_id, current_streak, longest_streak, last_study_date,
    total_study_days, total_questions_answered, total_correct_answers, updated_at
  )
  VALUES (
    NEW.user_id, 1, 1, v_today, 1, 1,
    CASE WHEN NEW.is_correct THEN 1 ELSE 0 END, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = CASE
      WHEN streak.last_study_date = v_today
        THEN streak.current_streak
      WHEN streak.last_study_date = v_today - 1
        THEN streak.current_streak + 1
      ELSE 1
    END,
    longest_streak = GREATEST(
      streak.longest_streak,
      CASE
        WHEN streak.last_study_date = v_today
          THEN streak.current_streak
        WHEN streak.last_study_date = v_today - 1
          THEN streak.current_streak + 1
        ELSE 1
      END
    ),
    last_study_date = v_today,
    total_study_days = streak.total_study_days
      + CASE WHEN streak.last_study_date IS DISTINCT FROM v_today THEN 1 ELSE 0 END,
    total_questions_answered = streak.total_questions_answered + 1,
    total_correct_answers = streak.total_correct_answers
      + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_study_streak ON public.pcpa_attempts;
CREATE TRIGGER trigger_update_study_streak
AFTER INSERT ON public.pcpa_attempts
FOR EACH ROW EXECUTE FUNCTION public.update_study_streak();

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
