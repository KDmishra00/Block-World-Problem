/**
 * Test Suite for STRIPS and Goal Stack Planner
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

const blocks = ['A', 'B', 'C', 'D'];

console.log('--- RUNNING STRIPS & PLANNER TESTS ---');

// Test 1: STRIPS State & Validator
console.log('Test 1: Arrangement to STRIPS State & Validation');
const p1 = { A: 'table', B: 'A', C: 'table', D: 'C' };
const v1 = STRIPS.validateArrangement(blocks, p1);
assert.strictEqual(v1.valid, true, 'Valid arrangement should pass');

const s1 = STRIPS.arrangementToState(blocks, p1);
assert.strictEqual(s1.has('ONTABLE(A)'), true);
assert.strictEqual(s1.has('ON(B,A)'), true);
assert.strictEqual(s1.has('CLEAR(B)'), true);
assert.strictEqual(s1.has('CLEAR(A)'), false);
assert.strictEqual(s1.has('ONTABLE(C)'), true);
assert.strictEqual(s1.has('ON(D,C)'), true);
assert.strictEqual(s1.has('CLEAR(D)'), true);
assert.strictEqual(s1.has('ARMEMPTY'), true);
console.log('✓ Test 1 Passed: Correct STRIPS predicates generated.');

// Test 2: Validation of invalid configurations
console.log('Test 2: Rejection of invalid arrangements');
const invalidSelf = { A: 'A', B: 'table', C: 'table', D: 'table' };
assert.strictEqual(STRIPS.validateArrangement(blocks, invalidSelf).valid, false);

const invalidCycle = { A: 'B', B: 'A', C: 'table', D: 'table' };
assert.strictEqual(STRIPS.validateArrangement(blocks, invalidCycle).valid, false);

const invalidDoubleSupport = { A: 'table', B: 'A', C: 'A', D: 'table' };
assert.strictEqual(STRIPS.validateArrangement(blocks, invalidDoubleSupport).valid, false);

console.log('✓ Test 2 Passed: Invalid configurations correctly rejected.');

// Test 3: Simple Plan (Invert 2 Blocks)
// Initial: A on B, B on table.
// Goal: B on A.
console.log('Test 3: Planning: Invert 2 Blocks (A on B -> B on A)');
const init3 = STRIPS.arrangementToState(blocks, { A: 'B', B: 'table', C: 'table', D: 'table' });
const goal3 = ['ON(B,A)'];
const res3 = GoalStackPlanner.generateAndVerifyPlan(init3, goal3, blocks);
assert.strictEqual(res3.success, true, 'Plan 3 should succeed');
console.log('Plan 3 steps:', res3.plan);
assert.deepStrictEqual(res3.plan, [
  'UNSTACK(A,B)',
  'PUTDOWN(A)',
  'PICKUP(B)',
  'STACK(B,A)'
]);
console.log('✓ Test 3 Passed: 2-block inversion generated and verified.');

// Test 4: Sussman Anomaly
// Initial: C on A, A on table, B on table.
// Goal: A on B, B on C.
console.log('Test 4: Sussman Anomaly (C on A -> A on B, B on C)');
const init4 = STRIPS.arrangementToState(blocks, { A: 'table', B: 'table', C: 'A', D: 'table' });
const goal4 = ['ON(A,B)', 'ON(B,C)'];
const res4 = GoalStackPlanner.generateAndVerifyPlan(init4, goal4, blocks);
assert.strictEqual(res4.success, true, 'Sussman Anomaly plan should succeed');
console.log('Sussman Plan steps:', res4.plan);
assert(res4.plan.length > 0);
console.log('✓ Test 4 Passed: Sussman Anomaly plan successfully generated & verified.');

// Test 4b: Sussman Anomaly with full goal arrangement (ONTABLE(C), ON(B,C), ON(A,B))
console.log('Test 4b: Sussman Anomaly with full goal state arrangement');
const goal4b = ['ONTABLE(C)', 'ON(B,C)', 'ON(A,B)'];
const res4b = GoalStackPlanner.generateAndVerifyPlan(init4, goal4b, blocks);
assert.strictEqual(res4b.success, true);
console.log('Sussman 4b Plan steps (' + res4b.plan.length + ' steps):', res4b.plan);
assert.deepStrictEqual(res4b.plan, [
  'UNSTACK(C,A)',
  'PUTDOWN(C)',
  'PICKUP(B)',
  'STACK(B,C)',
  'PICKUP(A)',
  'STACK(A,B)'
]);
console.log('✓ Test 4b Passed: Textbook 6-step Sussman solution generated & verified!');

// Test 5: 3-Block Stack Creation
// Initial: all on table
// Goal: A on B, B on C
console.log('Test 5: Build 3-block tower (all on table -> A on B on C)');
const init5 = STRIPS.arrangementToState(blocks, { A: 'table', B: 'table', C: 'table', D: 'table' });
const goal5 = ['ON(A,B)', 'ON(B,C)'];
const res5 = GoalStackPlanner.generateAndVerifyPlan(init5, goal5, blocks);
assert.strictEqual(res5.success, true, 'Tower plan should succeed');
console.log('Tower Plan steps:', res5.plan);
console.log('✓ Test 5 Passed: 3-block tower generated & verified.');

// Test 6: 4-Block Problem
// Initial: A on B, C on D, B on table, D on table
// Goal: D on C, C on B, B on A
console.log('Test 6: 4-block tower rearrangement');
const init6 = STRIPS.arrangementToState(blocks, { A: 'B', B: 'table', C: 'D', D: 'table' });
const goal6 = ['ON(D,C)', 'ON(C,B)', 'ON(B,A)'];
const res6 = GoalStackPlanner.generateAndVerifyPlan(init6, goal6, blocks);
assert.strictEqual(res6.success, true, '4-block plan should succeed');
console.log('4-block plan steps (' + res6.plan.length + ' steps):', res6.plan);
console.log('✓ Test 6 Passed: 4-block tower successfully generated & verified.');

console.log('\nALL 6 STRIPS & PLANNER TESTS PASSED PERFECTLY!\n');
