DROP POLICY IF EXISTS applicants_insert_anyone ON public.pending_applicants;

CREATE POLICY applicants_insert_anyone
ON public.pending_applicants
FOR INSERT
TO anon, authenticated
WITH CHECK (
  char_length(COALESCE(email, '')) BETWEEN 5 AND 320
  AND email LIKE '%@%.%'
  AND char_length(COALESCE(name, '')) BETWEEN 1 AND 200
  AND char_length(COALESCE(phone, '')) <= 32
  AND char_length(COALESCE(notes, '')) <= 2000
);