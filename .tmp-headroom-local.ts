const drafts = [
  { reward_purpose: 25, max_participants: 1, status: 'pending_vote', dao_proposal_id: '24365849424435418639976011406279478962541544967915231806116692019650815634033', vote_closes_at: '2026-05-20T22:59:18.99934+00:00' },
  { reward_purpose: 250, max_participants: 20, status: 'queued', dao_proposal_id: null, vote_closes_at: '2026-05-12T02:17:35.940616+00:00' },
];
const committedDrafts = drafts.reduce((sum, d) => {
  const voteStillOpen = !!d.vote_closes_at && new Date(d.vote_closes_at).getTime() > Date.now();
  const reservesHeadroom = Boolean(d.dao_proposal_id) || (d.status === 'pending_vote' && voteStillOpen);
  if (!reservesHeadroom) return sum;
  return sum + (Number(d.reward_purpose) || 0) * Math.max(1, Number(d.max_participants) || 1);
}, 0);
const backing = 27;
const outstanding = 0;
console.log(JSON.stringify({ committedDrafts, headroom: backing - outstanding - committedDrafts }, null, 2));
