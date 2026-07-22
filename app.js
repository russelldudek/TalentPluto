const brandScript=document.createElement('script');
brandScript.src='brand-runtime.js';
document.head.appendChild(brandScript);

const scenarios={
  onboarding:{context:'Business objective, visibility gap, data environment, owner.',delta:'Configure the shared product; instrument the client-specific delta.',proof:'Confirm task fit, data quality, adoption path, and measurable outcome.',decision:'Configure now. Return evidence to the roadmap review.',posture:'Configure the core. Instrument the delta.',evidence:'Outcome · repeatability · owner',authority:'Account lead + product owner',return:'Onboarding playbook + roadmap signal',active:1},
  attribution:{context:'Define the executive question, data sources, causal limits, and decision owner.',delta:'Keep the platform model stable; isolate the customer attribution layer.',proof:'Test CRM linkage, counterfactual logic, evaluation method, and decision usefulness.',decision:'Prototype with bounded claims before any product commitment.',posture:'Prototype the attribution layer. Preserve data boundaries.',evidence:'CRM linkage · causality · evaluation',authority:'Analytics owner + product',return:'Reusable attribution pattern + limits',active:2},
  agent:{context:'Identify the task, user, authority boundary, failure cost, and target outcome.',delta:'Separate reusable agent capability from account-specific context and tools.',proof:'Test tool use, failure modes, human review, latency, and acceptance criteria.',decision:'Advance only when authority and evaluation are explicit.',posture:'Prototype quickly. Define authority before scale.',evidence:'Task fit · failure modes · review',authority:'Named human decision owner',return:'Agent pattern + evaluation suite',active:3},
  exception:{context:'Clarify the commercial value, urgency, support burden, and expiry condition.',delta:'Name the exception explicitly rather than allowing a silent product fork.',proof:'Estimate delivery effort, maintenance cost, reuse probability, and exit path.',decision:'Deliver only when value exceeds burden and the exception expires cleanly.',posture:'Bound the exception—or decline it.',evidence:'Client value · burden · expiry',authority:'Commercial + product decision',return:'Exception rule + future screening',active:4}
};
const buttons=[...document.querySelectorAll('[data-scenario]')];
const translator=document.querySelector('#translator');
const fields={context:'contextValue',delta:'deltaValue',proof:'proofValue',decision:'decisionValue',posture:'postureValue',evidence:'evidenceValue',authority:'authorityValue',return:'returnValue'};
function applyScenario(key){
  const state=scenarios[key];
  buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scenario===key)));
  Object.entries(fields).forEach(([name,id])=>{document.getElementById(id).textContent=state[name]});
  document.querySelectorAll('[data-stage-card]').forEach((card,index)=>card.classList.toggle('active',index===state.active-1));
  const spine=translator.querySelector('.translation-spine span');
  if(spine)spine.style.width=`${state.active*25}%`;
}
buttons.forEach(button=>button.addEventListener('click',()=>applyScenario(button.dataset.scenario)));
buttons.forEach((button,index)=>button.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  let next=index;
  if(event.key==='ArrowRight')next=(index+1)%buttons.length;
  if(event.key==='ArrowLeft')next=(index-1+buttons.length)%buttons.length;
  if(event.key==='Home')next=0;
  if(event.key==='End')next=buttons.length-1;
  buttons[next].focus();buttons[next].click();
}));
applyScenario('onboarding');
