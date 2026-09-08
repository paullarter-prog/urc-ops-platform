// Panel approval state machine (Doc Section 5.1): Draft -> Submitted -> Under
// Review -> Approved -> Sent to Officials, with Reject returning to Draft.

const STATUSES = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Sent to Officials'];

const TRANSITIONS = {
  submit: { from: ['Draft'], to: 'Submitted' },
  review: { from: ['Submitted'], to: 'Under Review' },
  approve: { from: ['Submitted', 'Under Review'], to: 'Approved' },
  reject: { from: ['Submitted', 'Under Review'], to: 'Draft' },
  send: { from: ['Approved'], to: 'Sent to Officials' },
};

function applyTransition(currentStatus, action) {
  const status = currentStatus || 'Draft';
  const transition = TRANSITIONS[action];
  if (!transition) {
    return { ok: false, error: `Unknown action '${action}'` };
  }
  if (!transition.from.includes(status)) {
    return {
      ok: false,
      error: `Cannot ${action} a panel in '${status}' status (must be ${transition.from.join(' or ')})`,
    };
  }
  return { ok: true, status: transition.to };
}

module.exports = { STATUSES, TRANSITIONS, applyTransition };
