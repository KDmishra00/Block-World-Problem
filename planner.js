/**
 * Goal Stack Planner for STRIPS Blocks World
 *
 * Implements classical Goal Stack Planning:
 * - Stack contains:
 *     1. Compound Goals: Sets of predicates { g1, g2, ... }
 *     2. Single Predicates: e.g. ON(A, B), CLEAR(C)
 *     3. Operators (Actions): e.g. STACK(A, B), UNSTACK(C, A)
 *
 * Features:
 * - Genuine stack-based planning procedure with backtracking and cycle detection.
 * - Handles goal interactions (e.g. Sussman Anomaly) by trying subgoal orderings
 *   and verifying the conjunction.
 * - Forward simulation verification: executes the plan against the initial state to
 *   prove that every precondition is satisfied and the goal state is truly reached.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const strips = require('./strips.js');
    module.exports = factory(strips);
  } else {
    root.GoalStackPlanner = factory(root.STRIPS);
  }
})(typeof self !== 'undefined' ? self : this, function (STRIPS) {

  const {
    ACTIONS,
    normalizePredicate,
    parsePredicate,
    getActionDetails,
    cloneState,
    isSatisfied,
    areAllSatisfied,
    applyAction
  } = STRIPS;

  /**
   * Find actions that add a specific predicate.
   * Uses current state heuristics to instantiate free variables where applicable.
   */
  function getCandidateActionsForGoal(goalPred, currentState, allBlocks) {
    const parsed = parsePredicate(goalPred);
    const name = parsed.name;
    const candidates = [];

    if (name === 'ON') {
      const [x, y] = parsed.args;
      candidates.push({ type: 'STACK', args: [x, y] });
    } else if (name === 'ONTABLE') {
      const [x] = parsed.args;
      candidates.push({ type: 'PUTDOWN', args: [x] });
    } else if (name === 'CLEAR') {
      const [x] = parsed.args;
      // To make x clear, find whatever block y is currently on x, and unstack it
      let foundBlockOnX = null;
      for (const pred of currentState) {
        const p = parsePredicate(pred);
        if (p.name === 'ON' && p.args[1] === x) {
          foundBlockOnX = p.args[0];
          break;
        }
      }
      if (foundBlockOnX) {
        candidates.push({ type: 'UNSTACK', args: [foundBlockOnX, x] });
      } else {
        // Fallback: any other block in allBlocks could be on x
        for (const b of allBlocks) {
          if (b !== x) {
            candidates.push({ type: 'UNSTACK', args: [b, x] });
          }
        }
      }
    } else if (name === 'HOLDING') {
      const [x] = parsed.args;
      // If x is on table, PICKUP(x)
      if (isSatisfied(currentState, `ONTABLE(${x})`)) {
        candidates.push({ type: 'PICKUP', args: [x] });
      }
      // If x is on another block y, UNSTACK(x, y)
      let foundUnderX = null;
      for (const pred of currentState) {
        const p = parsePredicate(pred);
        if (p.name === 'ON' && p.args[0] === x) {
          foundUnderX = p.args[1];
          break;
        }
      }
      if (foundUnderX) {
        candidates.push({ type: 'UNSTACK', args: [x, foundUnderX] });
      } else {
        // Fallback: can consider both PICKUP and UNSTACK from any block
        candidates.push({ type: 'PICKUP', args: [x] });
        for (const y of allBlocks) {
          if (y !== x) {
            candidates.push({ type: 'UNSTACK', args: [x, y] });
          }
        }
      }
    } else if (name === 'ARMEMPTY') {
      // If holding block x, PUTDOWN(x) or STACK(x, y)
      let heldBlock = null;
      for (const pred of currentState) {
        const p = parsePredicate(pred);
        if (p.name === 'HOLDING') {
          heldBlock = p.args[0];
          break;
        }
      }
      if (heldBlock) {
        candidates.push({ type: 'PUTDOWN', args: [heldBlock] });
      } else {
        for (const b of allBlocks) {
          candidates.push({ type: 'PUTDOWN', args: [b] });
        }
      }
    }

    return candidates.map(c => `${c.type}(${c.args.join(',')})`);
  }

  /**
   * Sort top-level subgoals to prioritize foundational ones (e.g. bottom of stacks first)
   */
  function sortGoalsHeuristically(goals) {
    const list = Array.from(goals).map(normalizePredicate);
    // Goals like ONTABLE or ON(bottom, table) or ON(B, C) where C is on table should come before ON(A, B)
    // Build a dependency map: ON(X, Y) depends on Y being in its goal position first.
    return list.sort((a, b) => {
      const pa = parsePredicate(a);
      const pb = parsePredicate(b);
      if (pa.name === 'ONTABLE' && pb.name !== 'ONTABLE') return -1;
      if (pb.name === 'ONTABLE' && pa.name !== 'ONTABLE') return 1;
      if (pa.name === 'ON' && pb.name === 'ON') {
        // If a is ON(X, Y) and b is ON(Y, Z), b should be achieved before a!
        if (pa.args[1] === pb.args[0]) return 1;
        if (pb.args[1] === pa.args[0]) return -1;
      }
      return 0;
    });
  }

  /**
   * Recursive Goal Stack Planner Engine
   */
  function solveGoalStack(initialState, goalPredicates, allBlocks, options = {}) {
    const maxSteps = options.maxSteps || 100;
    const maxDepth = options.maxDepth || 80;

    // Generate permutations of goals if multiple
    const sortedGoals = sortGoalsHeuristically(goalPredicates);
    const permutations = [sortedGoals];
    if (sortedGoals.length > 1 && sortedGoals.length <= 4) {
      // Reverse order as alternative permutation
      permutations.push([...sortedGoals].reverse());
      // For 3 or 4, if needed, generate all permutations
      if (sortedGoals.length === 3) {
        permutations.push([sortedGoals[1], sortedGoals[0], sortedGoals[2]]);
        permutations.push([sortedGoals[1], sortedGoals[2], sortedGoals[0]]);
        permutations.push([sortedGoals[2], sortedGoals[0], sortedGoals[1]]);
        permutations.push([sortedGoals[0], sortedGoals[2], sortedGoals[1]]);
      }
    }

    let bestResult = null;
    let lastError = "Unable to find a valid plan.";

    for (const goalOrder of permutations) {
      const result = planWithOrder(initialState, goalOrder, allBlocks, maxSteps, maxDepth);
      if (result.success) {
        if (!bestResult || result.plan.length < bestResult.plan.length) {
          bestResult = result;
          // If we found a very short/direct plan, we can keep it
          if (bestResult.plan.length <= 6) break;
        }
      } else {
        lastError = result.error || lastError;
      }
    }

    if (bestResult) {
      return bestResult;
    }

    return {
      success: false,
      error: lastError,
      plan: []
    };
  }

  /**
   * Plan with a specific goal ordering
   */
  function planWithOrder(initialState, targetGoals, allBlocks, maxSteps, maxDepth) {
    let currentState = cloneState(initialState);
    const plan = [];

    // The stack contains items:
    // { type: 'COMPOUND', goals: [...] }
    // { type: 'PREDICATE', pred: '...' }
    // { type: 'ACTION', action: '...' }
    const stack = [];

    // Push overall goal conjunction and initial subgoals (in reverse order so first is popped first)
    stack.push({ type: 'COMPOUND', goals: [...targetGoals] });
    for (let i = targetGoals.length - 1; i >= 0; i--) {
      stack.push({ type: 'PREDICATE', pred: targetGoals[i] });
    }

    const visitedStates = new Set();
    let stepsCount = 0;
    let stackPops = 0;

    while (stack.length > 0) {
      stackPops++;
      if (stackPops > maxDepth * 30 || plan.length > maxSteps) {
        return {
          success: false,
          error: `Goal Stack Planning exceeded step limit (${maxSteps} steps / recursion limit). Possible circular dependency or dead end.`,
          plan: []
        };
      }

      const top = stack.pop();

      if (top.type === 'COMPOUND') {
        if (!areAllSatisfied(currentState, top.goals)) {
          // If the conjunction is not satisfied, push it back and push unsatisfied subgoals
          stack.push(top);
          const unsatisfied = top.goals.filter(g => !isSatisfied(currentState, g));
          for (let i = unsatisfied.length - 1; i >= 0; i--) {
            stack.push({ type: 'PREDICATE', pred: unsatisfied[i] });
          }
        }
      } else if (top.type === 'PREDICATE') {
        const pred = normalizePredicate(top.pred);
        if (isSatisfied(currentState, pred)) {
          // Already true, do nothing
          continue;
        }

        // Find an action whose Add effects contain pred
        const candidates = getCandidateActionsForGoal(pred, currentState, allBlocks);
        if (candidates.length === 0) {
          return {
            success: false,
            error: `No valid STRIPS action can achieve unsatisfied condition: ${pred}`,
            plan: []
          };
        }

        // Pick the first viable candidate action
        const chosenAction = candidates[0];
        const actionDetails = getActionDetails(chosenAction);

        // Push operator
        stack.push({ type: 'ACTION', action: chosenAction });

        // Push operator's preconditions as compound goal
        stack.push({ type: 'COMPOUND', goals: [...actionDetails.preconditions] });

        // Push individual preconditions in sorted order (foundation first, holding last)
        const sortedPre = [...actionDetails.preconditions].sort((a, b) => {
          if (a.startsWith('CLEAR') && !b.startsWith('CLEAR')) return -1;
          if (b.startsWith('CLEAR') && !a.startsWith('CLEAR')) return 1;
          if (a === 'ARMEMPTY') return -1;
          if (b === 'ARMEMPTY') return 1;
          return 0;
        });

        for (let i = sortedPre.length - 1; i >= 0; i--) {
          stack.push({ type: 'PREDICATE', pred: sortedPre[i] });
        }
      } else if (top.type === 'ACTION') {
        const actStr = top.action;
        const details = getActionDetails(actStr);

        // Verify that all preconditions are satisfied in current state
        if (!areAllSatisfied(currentState, details.preconditions)) {
          // Preconditions were not met; push action and missing preconditions back
          stack.push(top);
          const missing = details.preconditions.filter(p => !isSatisfied(currentState, p));
          for (let i = missing.length - 1; i >= 0; i--) {
            stack.push({ type: 'PREDICATE', pred: missing[i] });
          }
          continue;
        }

        // Execute action
        currentState = applyAction(currentState, actStr, true);
        plan.push(actStr);

        // State loop check
        const stateKey = Array.from(currentState).sort().join('|');
        if (visitedStates.has(stateKey + '::' + actStr)) {
          // Loop detected in execution path
          return {
            success: false,
            error: `Infinite loop detected in planner at state: ${stateKey}`,
            plan: []
          };
        }
        visitedStates.add(stateKey + '::' + actStr);
      }
    }

    // Finally, verify that all target goals are satisfied in the end state
    if (!areAllSatisfied(currentState, targetGoals)) {
      return {
        success: false,
        error: "Final state does not satisfy all goal conditions after execution.",
        plan: []
      };
    }

    return {
      success: true,
      plan,
      finalState: currentState
    };
  }

  /**
   * Verify and simulate the plan step-by-step from initialState to goalPredicates.
   * Returns a detailed execution trace with before-state, action, after-state.
   */
  function simulatePlan(initialState, plan, goalPredicates) {
    let state = cloneState(initialState);
    const trace = [];

    for (let i = 0; i < plan.length; i++) {
      const act = plan[i];
      const details = getActionDetails(act);
      const missing = details.preconditions.filter(p => !isSatisfied(state, p));

      if (missing.length > 0) {
        return {
          verified: false,
          error: `Step ${i + 1} (${details.raw}) failed: precondition(s) not satisfied: ${missing.join(', ')}`,
          trace
        };
      }

      const beforeState = cloneState(state);
      state = applyAction(state, act, true);
      trace.push({
        stepNumber: i + 1,
        action: details.raw,
        name: details.name,
        args: details.args,
        description: details.description,
        preconditions: details.preconditions,
        addList: details.addList,
        deleteList: details.deleteList,
        beforeState: Array.from(beforeState).sort(),
        afterState: Array.from(state).sort()
      });
    }

    const goalMissing = Array.from(goalPredicates).filter(g => !isSatisfied(state, g));
    if (goalMissing.length > 0) {
      return {
        verified: false,
        error: `Plan completed, but final state does not satisfy goals: ${goalMissing.join(', ')}`,
        trace
      };
    }

    return {
      verified: true,
      trace,
      finalState: state
    };
  }

  /**
   * Public Planning Interface:
   * 1. Generates the plan using Goal Stack Planning
   * 2. Simulates & verifies the entire plan
   * 3. Returns structured plan and step details
   */
  function generateAndVerifyPlan(initialState, goalPredicates, allBlocks, options = {}) {
    const rawResult = solveGoalStack(initialState, goalPredicates, allBlocks, options);
    if (!rawResult.success) {
      return {
        success: false,
        error: rawResult.error,
        plan: [],
        trace: []
      };
    }

    const sim = simulatePlan(initialState, rawResult.plan, goalPredicates);
    if (!sim.verified) {
      return {
        success: false,
        error: `Simulation verification failed: ${sim.error}`,
        plan: rawResult.plan,
        trace: sim.trace
      };
    }

    return {
      success: true,
      plan: rawResult.plan,
      trace: sim.trace,
      finalState: sim.finalState
    };
  }

  return {
    getCandidateActionsForGoal,
    sortGoalsHeuristically,
    solveGoalStack,
    simulatePlan,
    generateAndVerifyPlan
  };
});
