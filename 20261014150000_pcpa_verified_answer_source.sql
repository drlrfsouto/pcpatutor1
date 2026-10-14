-- Recreate the public read policy so both the question document and, when
-- stored separately, the official answer-key document must use trusted hosts.
-- A missing url_gabarito remains valid for legacy rows whose answer is in
-- url_fonte; new search results store the answer URL explicitly.

DROP POLICY IF EXISTS "Questions are readable by everyone" ON public.pcpa_questions;
DROP POLICY IF EXISTS "Only verified official questions are readable" ON public.pcpa_questions;

CREATE POLICY "Only verified official questions are readable"
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
    AND UPPER(LEFT(BTRIM(answer), 1)) IN ('A', 'B', 'C', 'D', 'E')
    AND UPPER(LEFT(BTRIM(metadata ->> 'gabarito_oficial'), 1)) = UPPER(LEFT(BTRIM(answer), 1))
    AND CASE
      WHEN JSONB_TYPEOF(options) = 'array' THEN JSONB_ARRAY_LENGTH(options) = 5
      ELSE FALSE
    END
    AND NULLIF(BTRIM(prompt), '') IS NOT NULL
    AND metadata ->> 'url_fonte' ~* '^https?://([a-z0-9-]+\.)*(cebraspe\.org\.br|fadesp\.org\.br|fgv\.br|institutoaocp\.org\.br|vunesp\.com\.br|concursosfcc\.com\.br|cesgranrio\.org\.br|ibfc\.org\.br|quadrix\.org\.br|idecan\.org\.br|institutoconsulplan\.org\.br|iades\.com\.br|gov\.br|pa\.gov\.br)(:[0-9]+)?([/?#]|$)'
    AND (
      NULLIF(BTRIM(metadata ->> 'url_gabarito'), '') IS NULL
      OR metadata ->> 'url_gabarito' ~* '^https?://([a-z0-9-]+\.)*(cebraspe\.org\.br|fadesp\.org\.br|fgv\.br|institutoaocp\.org\.br|vunesp\.com\.br|concursosfcc\.com\.br|cesgranrio\.org\.br|ibfc\.org\.br|quadrix\.org\.br|idecan\.org\.br|institutoconsulplan\.org\.br|iades\.com\.br|gov\.br|pa\.gov\.br)(:[0-9]+)?([/?#]|$)'
    )
  );
