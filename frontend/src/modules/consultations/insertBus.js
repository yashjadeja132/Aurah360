/**
 * Insert bus — carries AI-accepted text from the copilot panel into the clinical record forms
 * (SOAP, diagnosis, follow-up, lab orders, prescription draft) that live in a sibling column of
 * the consultation workspace.
 *
 * Why a bus and not props: the note sections are tabbed, so the target form may be UNMOUNTED at
 * the moment the doctor clicks Accept. Insertions are queued per target and flushed as soon as
 * that target mounts, so "Accept condition" works even while the doctor is looking at Vitals.
 *
 * Nothing here writes to the server. An insertion only fills a form field; the doctor still edits
 * and presses the form's own Save, and signing stays a separate explicit action.
 */

const handlers = new Map(); // target -> Set<handler>
const pending = new Map(); // target -> payload[]

export const INSERT_TARGETS = Object.freeze({
  SOAP_SUBJECTIVE: 'soap.subjective',
  SOAP_OBJECTIVE: 'soap.objective',
  SOAP_ASSESSMENT: 'soap.assessment',
  SOAP_PLAN: 'soap.plan',
  DIAGNOSIS: 'diagnosis',
  FOLLOW_UP_INSTRUCTIONS: 'followUp.instructions',
  LAB_ORDER: 'labOrder',
  PRESCRIPTION_LINE: 'prescription.line',
});

/** Fire an insertion at a target. Queued if nothing is listening yet. */
export function emitInsert(target, payload) {
  const set = handlers.get(target);
  if (set && set.size > 0) {
    set.forEach((fn) => fn(payload));
    return;
  }
  const queue = pending.get(target) || [];
  queue.push(payload);
  pending.set(target, queue);
}

/** Subscribe to a target. Returns an unsubscribe function. Flushes anything queued. */
export function subscribeInsert(target, handler) {
  const set = handlers.get(target) || new Set();
  set.add(handler);
  handlers.set(target, set);

  const queued = pending.get(target);
  if (queued?.length) {
    pending.delete(target);
    queued.forEach((payload) => handler(payload));
  }

  return () => {
    const current = handlers.get(target);
    if (!current) return;
    current.delete(handler);
    if (current.size === 0) handlers.delete(target);
  };
}

/** Clear every queued insertion — used when the workspace unmounts. */
export function resetInsertQueue() {
  pending.clear();
}

/** Append `addition` to `existing` as its own paragraph, skipping exact duplicates. */
export function appendText(existing, addition) {
  const base = (existing || '').trim();
  const add = (addition || '').trim();
  if (!add) return base;
  if (!base) return add;
  if (base.includes(add)) return base;
  return `${base}\n${add}`;
}

/** Merge a value into a comma-separated string field without duplicating entries. */
export function appendCsv(existing, addition) {
  const parts = (existing || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const add = (addition || '').trim();
  if (!add) return parts.join(', ');
  if (parts.some((p) => p.toLowerCase() === add.toLowerCase())) return parts.join(', ');
  parts.push(add);
  return parts.join(', ');
}
