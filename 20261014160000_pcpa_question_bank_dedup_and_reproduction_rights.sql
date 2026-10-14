-- Versioned local question bank support: stable fingerprints make repeated
-- imports idempotent, while public reads require explicit permission to copy
-- the question text (not merely an official hosting domain).

ALTER TABLE public.pcpa_questions
  ADD COLUMN IF NOT EXISTS question_fingerprint TEXT;

COMMENT ON COLUMN public.pcpa_questions.question_fingerprint IS
'SHA-256 fingerprint of the verified exam identity, question number, type and normalized prompt; used to prevent duplicate imports from the versioned catalog and web search.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcpa_questions_fingerprint
  ON public.pcpa_questions(question_fingerprint);

DROP POLICY IF EXISTS "Questions are readable by everyone" ON public.pcpa_questions;
DROP POLICY IF EXISTS "Only verified official questions are readable" ON public.pcpa_questions;
DROP POLICY IF EXISTS "Only licensed verified questions are readable" ON public.pcpa_questions;

CREATE POLICY "Only licensed verified questions are readable"
  ON public.pcpa_questions
  FOR SELECT
  TO anon, authenticated
  USING (
    source = 'concurso_real'
    AND NULLIF(BTRIM(metadata ->> 'concurso'), '') IS NOT NULL
    AND NULLIF(BTRIM(metadata ->> 'banca'), '') IS NOT NULL
    AND NULLIF(BTRIM(metadata ->> 'cargo'), '') IS NOT NULL
    AND NULLIF(BTRIM(metadata ->> 'numero_questao'), '') IS NOT NULL
    AND CASE
      WHEN (metadata ->> 'ano') ~ '^[0-9]{4}$'
        THEN (metadata ->> 'ano')::INTEGER BETWEEN 2000 AND EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
      ELSE FALSE
    END
    AND metadata ->> 'reproduction_permission' = 'explicit'
    AND NULLIF(BTRIM(metadata ->> 'license_terms'), '') IS NOT NULL
    AND metadata ->> 'license_evidence_url' ~* '^https?://([a-z0-9-]+\.)*(cebraspe\.org\.br|fadesp\.org\.br|fgv\.br|institutoaocp\.org\.br|vunesp\.com\.br|concursosfcc\.com\.br|cesgranrio\.org\.br|ibfc\.org\.br|quadrix\.org\.br|idecan\.org\.br|institutoconsulplan\.org\.br|iades\.com\.br|gov\.br|pa\.gov\.br)(:[0-9]+)?([/?#]|$)'
    AND (
      NULLIF(BTRIM(metadata ->> 'data_aplicacao'), '') IS NULL
      OR metadata ->> 'application_date_evidence_url' ~* '^https?://([a-z0-9-]+\.)*(cebraspe\.org\.br|fadesp\.org\.br|fgv\.br|institutoaocp\.org\.br|vunesp\.com\.br|concursosfcc\.com\.br|cesgranrio\.org\.br|ibfc\.org\.br|quadrix\.org\.br|idecan\.org\.br|institutoconsulplan\.org\.br|iades\.com\.br|gov\.br|pa\.gov\.br)(:[0-9]+)?([/?#]|$)'
    )
    AND metadata ->> 'url_fonte' ~* '^https?://([a-z0-9-]+\.)*(cebraspe\.org\.br|fadesp\.org\.br|fgv\.br|institutoaocp\.org\.br|vunesp\.com\.br|concursosfcc\.com\.br|cesgranrio\.org\.br|ibfc\.org\.br|quadrix\.org\.br|idecan\.org\.br|institutoconsulplan\.org\.br|iades\.com\.br|gov\.br|pa\.gov\.br)(:[0-9]+)?([/?#]|$)'
    AND metadata ->> 'url_gabarito' ~* '^https?://([a-z0-9-]+\.)*(cebraspe\.org\.br|fadesp\.org\.br|fgv\.br|institutoaocp\.org\.br|vunesp\.com\.br|concursosfcc\.com\.br|cesgranrio\.org\.br|ibfc\.org\.br|quadrix\.org\.br|idecan\.org\.br|institutoconsulplan\.org\.br|iades\.com\.br|gov\.br|pa\.gov\.br)(:[0-9]+)?([/?#]|$)'
    AND UPPER(LEFT(BTRIM(answer), 1)) = UPPER(LEFT(BTRIM(metadata ->> 'gabarito_oficial'), 1))
    AND NULLIF(BTRIM(prompt), '') IS NOT NULL
    AND (
      (
        type = 'multipla_escolha'
        AND UPPER(LEFT(BTRIM(answer), 1)) IN ('A', 'B', 'C', 'D', 'E')
        AND CASE
          WHEN JSONB_TYPEOF(options) = 'array' THEN JSONB_ARRAY_LENGTH(options) = 5
          ELSE FALSE
        END
      )
      OR
      (
        type = 'certo_errado'
        AND UPPER(LEFT(BTRIM(answer), 1)) IN ('C', 'E')
        AND CASE
          WHEN JSONB_TYPEOF(options) = 'array'
            THEN JSONB_ARRAY_LENGTH(options) = 2
              AND LOWER(BTRIM(options ->> 0)) = 'certo'
              AND LOWER(BTRIM(options ->> 1)) = 'errado'
          ELSE FALSE
        END
      )
    )
  );
