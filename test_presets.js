/**
 * Verification of all 5 benchmark presets: plan generation + execution trace + final state check
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const STRIPS = fs.existsSync(path.join(__dirname, 'strips.js'))
  ? require('./strips.js')
  : require('./js/strips.js');
const GoalStackPlanner = fs.existsSync(path.join(__dirname, 'planner.js'))
  ? require('./planner.js')
  : require('./js/planner.js');

const BLOCKS = ['A', 'B', 'C', 'D'];

const PRESETS = [
  {
    name: 'Sussman Anomaly',
    initial: { A: 'table', B: 'table', C: 'A', D: 'table' },
    goal: { A: 'B', B: 'C', C: 'table', D: 'table' }
  },
  {
    name: 'Invert 2 Blocks',
    initial: { A: 'B', B: 'table', C: 'table', D: 'table' },
    goal: { A: 'table', B: 'A', C: 'table', D: 'table' }
  },
  {
    name: 'Build 3-Block Tower',
    initial: { A: 'table', B: 'table', C: 'table', D: 'table' },
    goal: { A: 'B', B: 'C', C: 'table', D: 'table' }
  },
  {
    name: '4-Block Tower Inversion',
    initial: { A: 'B', B: 'C', C: 'D', D: 'table' },
    goal: { D: 'C', C: 'B', B: 'A', A: 'table' }
  },
  {
    name: 'Clear All Blocks to Table',
    initial: { A: 'B', B: 'table', C: 'D', D: 'table' },
    goal: { A: 'table', B: 'table', C: 'table', D: 'table' }
  }
];

console.log('--- TESTING ALL 5 BENCHMARK PRESETS ---');

for (const p of PRESETS) {
  console.log(`\nTesting Preset: "${p.name}"`);
  
  // Validation
  const vInit = STRIPS.validateArrangement(BLOCKS, p.initial);
  const vGoal = STRIPS.validateArrangement(BLOCKS, p.goal);
  assert.strictEqual(vInit.valid, true, `Initial configuration must be valid: ${vInit.errors}`);
  assert.strictEqual(vGoal.valid, true, `Goal configuration must be valid: ${vGoal.errors}`);

  const initState = STRIPS.arrangementToState(BLOCKS, p.initial);
  const goalState = STRIPS.arrangementToState(BLOCKS, p.goal);

  const goalPreds = Array.from(goalState).filter(pred => {
    const parsed = STRIPS.parsePredicate(pred);
    return parsed.name === 'ON' || parsed.name === 'ONTABLE';
  });

  const res = GoalStackPlanner.generateAndVerifyPlan(initState, goalPreds, BLOCKS);
  assert.strictEqual(res.success, true, `Plan must succeed for preset ${p.name}: ${res.error}`);
  console.log(`✓ Synthesized ${res.plan.length}-step plan: [${res.plan.join(', ')}]`);

  // Step-by-step simulated execution
  let curr = STRIPS.cloneState(initState);
  for (let i = 0; i < res.plan.length; i++) {
    const act = res.plan[i];
    curr = STRIPS.applyAction(curr, act, true);
  }

  // Final condition check
  const satisfied = STRIPS.areAllSatisfied(curr, goalPreds);
  assert.strictEqual(satisfied, true, `Final state must satisfy goal predicates for ${p.name}`);
  console.log(`✓ Verified: Final state satisfies all goal predicates.`);
}

console.log('\nALL 5 BENCHMARK PRESETS VERIFIED SUCCESSFULLY!\n');
