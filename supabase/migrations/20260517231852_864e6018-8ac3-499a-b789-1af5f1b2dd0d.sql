ALTER TABLE public.bounty_drafts DISABLE TRIGGER USER;

UPDATE public.bounty_drafts
SET dao_proposal_id = '24365849424435418639976011406279478962541544967915231806116692019650815634033',
    on_chain_tx_hash = '0xc5f07e3cba7daf817f5a9885bf3ad5d720acb0db154786255e162add52977115',
    updated_at = now()
WHERE id = 'cc40b9df-d50c-4dc7-a713-072aed2389e9';

ALTER TABLE public.bounty_drafts ENABLE TRIGGER USER;