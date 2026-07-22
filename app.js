const SCENARIOS = {
  attribution: {
    label: 'Attribution proof',
    request: '“Can you prove what AI search is changing for our pipeline—and make the answer useful next quarter?”',
    need: 'A defensible executive decision, not a vanity report.',
    name: 'Attribution proof plan',
    status: 'PROTOTYPE',
    intent: 'Decide where AI-search visibility is influencing pipeline.',
    context: 'CRM stages, source taxonomy, visibility signals, executive owner.',
    constraint: 'Causal claims must remain inside the available evidence.',
    proof: 'Link one visibility signal to one pipeline decision with an explicit evaluation method.',
    reuse: 'A bounded attribution primitive that can serve multiple accounts.',
    disposition: 'Prototype with bounded claims',
    authority: 'Analytics owner + product owner',
    learningReturn: 'Attribution pattern, limits, and handoff criteria'
  },
  onboarding: {
    label: 'Complex onboarding',
    request: '“Our CRM, taxonomy, and approval path are different. Can the product fit without becoming a custom fork?”',
    need: 'Fast time-to-value without hiding future support burden.',
    name: 'Complex onboarding plan',
    status: 'CONFIGURE',
    intent: 'Activate the shared product inside a non-standard operating environment.',
    context: 'CRM schema, taxonomy, data owners, approval path, adoption workflow.',
    constraint: 'Variation must remain bounded, documented, and supportable.',
    proof: 'Complete one end-to-end configuration path and measure handoff completeness.',
    reuse: 'A reusable mapping pattern and explicit configuration boundary.',
    disposition: 'Configure the core; document the delta',
    authority: 'Account lead + implementation owner',
    learningReturn: 'Onboarding playbook and configuration rule'
  },
  agent: {
    label: 'Discovery agent',
    request: '“Could an agent find emerging search opportunities and tell our team what to do next?”',
    need: 'A useful decision aid with clear human authority.',
    name: 'Discovery agent plan',
    status: 'PROTOTYPE',
    intent: 'Surface high-value opportunities and a recommended next action.',
    context: 'User workflow, source data, tools, latency, escalation owner.',
    constraint: 'The agent may recommend; a named human retains the decision.',
    proof: 'Test task fit, tool use, failure modes, review burden, and acceptance criteria.',
    reuse: 'An agent pattern plus an evaluation and authority contract.',
    disposition: 'Prototype with a named review gate',
    authority: 'Named human decision owner',
    learningReturn: 'Agent pattern, evaluation suite, and escalation rule'
  },
  exception: {
    label: 'One-off report',
    request: '“A strategic customer needs a custom executive report by Friday. Can we just build it?”',
    need: 'Protect the relationship without quietly expanding the product surface.',
    name: 'One-off exception plan',
    status: 'DECLINE / BOUND',
    intent: 'Decide whether the request creates enough value to justify an explicit exception.',
    context: 'Commercial value, urgency, executive audience, data access, delivery owner.',
    constraint: 'The exception needs a support boundary, expiry, and no implied roadmap promise.',
    proof: 'Estimate delivery effort, maintenance burden, reuse probability, and exit path.',
    reuse: 'A screening rule for future exceptions—not necessarily a product feature.',
    disposition: 'Bound the exception—or decline it',
    authority: 'Commercial owner + product owner',
    learningReturn: 'Exception rule and future screening criteria'
  }
};

const ids = {
  request: 'requestText', need: 'customerNeed', name: 'planName', status: 'planStatus',
  intent: 'intentValue', context: 'contextValue', constraint: 'constraintValue',
  proof: 'proofValue', reuse: 'reuseValue', disposition: 'dispositionValue',
  authority: 'authorityValue', learningReturn: 'returnValue'
};
const buttons = [...document.querySelectorAll('[data-scenario]')];
const workbench = document.getElementById('queryWorkbench');
const announcement = document.getElementById('stateAnnouncement');
let updateTimer = 0;
let updateToken = 0;

function settleHero() {
  const hero = document.getElementById('heroPlan');
  if (!hero) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    hero.dataset.state = 'settled';
    return;
  }
  hero.dataset.state = 'running';
  window.setTimeout(() => { hero.dataset.state = 'settled'; }, 1450);
}

function applyScenario(key, { animate = true, focus = false } = {}) {
  const state = SCENARIOS[key];
  if (!state || !workbench) return;
  updateToken += 1;
  const token = updateToken;
  window.clearTimeout(updateTimer);
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === key)));
  workbench.dataset.mode = key;
  if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    workbench.classList.remove('is-updating');
    void workbench.offsetWidth;
    workbench.classList.add('is-updating');
  } else {
    workbench.classList.remove('is-updating');
  }
  Object.entries(ids).forEach(([field, id]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = state[field];
  });
  if (announcement) announcement.textContent = `${state.label} scenario selected. Disposition: ${state.disposition}.`;
  updateTimer = window.setTimeout(() => {
    if (token !== updateToken) return;
    workbench.classList.remove('is-updating');
  }, 760);
  if (focus) document.querySelector(`[data-scenario="${key}"]`)?.focus();
}

buttons.forEach((button, index) => {
  button.addEventListener('click', () => applyScenario(button.dataset.scenario));
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    buttons[next].click();
    buttons[next].focus();
  });
});

document.getElementById('resetScenario')?.addEventListener('click', () => applyScenario('attribution', { animate: true, focus: true }));
settleHero();
applyScenario('attribution', { animate: false });
