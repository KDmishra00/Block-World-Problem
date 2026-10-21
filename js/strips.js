/**
 * STRIPS Formalism for Blocks World
 * Supported Predicates:
 *   ON(x, y)      - Block x is directly on block y
 *   ONTABLE(x)    - Block x is directly on the table
 *   CLEAR(x)      - No block is on top of block x
 *   HOLDING(x)    - The robot arm is currently holding block x
 *   ARMEMPTY      - The robot arm is empty
 *
 * Standard Actions:
 *   PICKUP(x)     - Pick up block x from the table
 *   PUTDOWN(x)    - Put down block x onto the table
 *   UNSTACK(x, y) - Pick up block x from on top of block y
 *   STACK(x, y)   - Place block x onto block y
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.STRIPS = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Action Definitions with Preconditions, Add Effects, Delete Effects
  const ACTIONS = {
    PICKUP: {
      name: 'PICKUP',
      arity: 1,
      getPreconditions: (x) => [`ONTABLE(${x})`, `CLEAR(${x})`, 'ARMEMPTY'],
      getAddList: (x) => [`HOLDING(${x})`],
      getDeleteList: (x) => [`ONTABLE(${x})`, `CLEAR(${x})`, 'ARMEMPTY'],
      describe: (x) => `Pick up block ${x} from the table.`
    },
    PUTDOWN: {
      name: 'PUTDOWN',
      arity: 1,
      getPreconditions: (x) => [`HOLDING(${x})`],
      getAddList: (x) => [`ONTABLE(${x})`, `CLEAR(${x})`, 'ARMEMPTY'],
      getDeleteList: (x) => [`HOLDING(${x})`],
      describe: (x) => `Put down block ${x} onto the table.`
    },
    UNSTACK: {
      name: 'UNSTACK',
      arity: 2,
      getPreconditions: (x, y) => [`ON(${x},${y})`, `CLEAR(${x})`, 'ARMEMPTY'],
      getAddList: (x, y) => [`HOLDING(${x})`, `CLEAR(${y})`],
      getDeleteList: (x, y) => [`ON(${x},${y})`, `CLEAR(${x})`, 'ARMEMPTY'],
      describe: (x, y) => `Unstack block ${x} from on top of block ${y}.`
    },
    STACK: {
      name: 'STACK',
      arity: 2,
      getPreconditions: (x, y) => [`HOLDING(${x})`, `CLEAR(${y})`],
      getAddList: (x, y) => [`ON(${x},${y})`, `CLEAR(${x})`, 'ARMEMPTY'],
      getDeleteList: (x, y) => [`HOLDING(${x})`, `CLEAR(${y})`],
      describe: (x, y) => `Stack block ${x} onto block ${y}.`
    }
  };

  /**
   * Normalize predicate string (e.g. "ON( A , B )" -> "ON(A,B)")
   */
  function normalizePredicate(p) {
    return p.replace(/\s+/g, '').toUpperCase();
  }

  /**
   * Parse predicate string into object { name, args }
   */
  function parsePredicate(predStr) {
    const cleaned = normalizePredicate(predStr);
    const match = cleaned.match(/^([A-Z]+)(?:\((.*)\))?$/);
    if (!match) return { name: cleaned, args: [] };
    const name = match[1];
    const args = match[2] ? match[2].split(',').filter(Boolean) : [];
    return { name, args, raw: cleaned };
  }

  /**
   * Format predicate
   */
  function formatPredicate(name, args = []) {
    return args.length > 0 ? `${name}(${args.join(',')})` : name;
  }

  /**
   * Action string parser (e.g. "STACK(A,B)" -> { type: 'STACK', args: ['A','B'] })
   */
  function parseAction(actionStr) {
    const cleaned = normalizePredicate(actionStr);
    const match = cleaned.match(/^([A-Z]+)\((.*)\)$/);
    if (!match) throw new Error(`Invalid action string: ${actionStr}`);
    const type = match[1];
    const args = match[2].split(',').filter(Boolean);
    if (!ACTIONS[type]) throw new Error(`Unknown action type: ${type}`);
    return {
      type,
      args,
      raw: `${type}(${args.join(',')})`,
      definition: ACTIONS[type]
    };
  }

  /**
   * Convert raw action or parsed action to its STRIPS pre, add, del sets
   */
  function getActionDetails(actionOrStr) {
    const act = typeof actionOrStr === 'string' ? parseAction(actionOrStr) : actionOrStr;
    const def = ACTIONS[act.type];
    if (!def) throw new Error(`Unknown action: ${act.type}`);
    const pre = def.getPreconditions(...act.args).map(normalizePredicate);
    const add = def.getAddList(...act.args).map(normalizePredicate);
    const del = def.getDeleteList(...act.args).map(normalizePredicate);
    const description = def.describe ? def.describe(...act.args) : act.raw;
    return {
      name: act.type,
      args: act.args,
      raw: act.raw || `${act.type}(${act.args.join(',')})`,
      preconditions: pre,
      addList: add,
      deleteList: del,
      description
    };
  }

  /**
   * Clone a state Set
   */
  function cloneState(state) {
    return new Set(Array.from(state).map(normalizePredicate));
  }

  /**
   * Check if a single predicate is satisfied in state
   */
  function isSatisfied(state, predicate) {
    return state.has(normalizePredicate(predicate));
  }

  /**
   * Check if all predicates in list are satisfied in state
   */
  function areAllSatisfied(state, predicates) {
    for (const p of predicates) {
      if (!isSatisfied(state, p)) return false;
    }
    return true;
  }

  /**
   * Apply an action to a state.
   * Throws if preconditions are not satisfied unless checkPreconditions = false.
   * Returns a new state (Set).
   */
  function applyAction(state, actionOrStr, checkPreconditions = true) {
    const details = getActionDetails(actionOrStr);
    if (checkPreconditions) {
      const missing = details.preconditions.filter(p => !state.has(p));
      if (missing.length > 0) {
        throw new Error(
          `Cannot execute ${details.raw}: missing precondition(s): ${missing.join(', ')}`
        );
      }
    }
    const nextState = cloneState(state);
    for (const d of details.deleteList) {
      nextState.delete(d);
    }
    for (const a of details.addList) {
      nextState.add(a);
    }
    return nextState;
  }

  /**
   * Convert an arrangement of blocks into complete STRIPS state.
   * blocks: array of block IDs, e.g. ['A', 'B', 'C', 'D']
   * placement: object mapping block -> 'table' | otherBlockId | 'hand'
   */
  function arrangementToState(blocks, placement) {
    const state = new Set();
    let armHolding = null;

    // Check which blocks are supported or held
    const supportedBy = {}; // block -> support
    const topOf = {};       // block -> block on top of it

    for (const b of blocks) {
      const pos = placement[b];
      if (pos === 'hand') {
        armHolding = b;
        state.add(`HOLDING(${b})`);
      } else if (pos === 'table') {
        state.add(`ONTABLE(${b})`);
        supportedBy[b] = 'table';
      } else if (pos) {
        state.add(`ON(${b},${pos})`);
        supportedBy[b] = pos;
        topOf[pos] = b;
      }
    }

    if (armHolding === null) {
      state.add('ARMEMPTY');
    }

    // A block is CLEAR if nothing is directly on top of it and it's not in hand
    for (const b of blocks) {
      if (placement[b] !== 'hand' && !topOf[b]) {
        state.add(`CLEAR(${b})`);
      }
    }

    return state;
  }

  /**
   * Convert a STRIPS state Set into an arrangement representation
   */
  function stateToArrangement(blocks, state) {
    const placement = {};
    const held = [];

    for (const b of blocks) {
      placement[b] = null;
    }

    for (const pred of state) {
      const p = parsePredicate(pred);
      if (p.name === 'ONTABLE' && p.args[0]) {
        placement[p.args[0]] = 'table';
      } else if (p.name === 'ON' && p.args[0] && p.args[1]) {
        placement[p.args[0]] = p.args[1];
      } else if (p.name === 'HOLDING' && p.args[0]) {
        placement[p.args[0]] = 'hand';
        held.push(p.args[0]);
      }
    }

    return {
      placement,
      holding: held.length > 0 ? held[0] : null
    };
  }

  /**
   * Validate a block arrangement to prevent invalid configurations:
   * - Self-stacking (A on A)
   * - Cycles (A on B, B on A)
   * - Multiple blocks directly on same block
   * - Floating blocks (must reach table)
   * - Multiple blocks in hand
   */
  function validateArrangement(blocks, placement) {
    const errors = [];
    const supportedBy = {};
    const supporting = {};
    let handCount = 0;

    for (const b of blocks) {
      const pos = placement[b];
      if (!pos) {
        errors.push(`Block ${b} has no assigned position.`);
        continue;
      }
      if (pos === 'hand') {
        handCount++;
        if (handCount > 1) {
          errors.push(`Robot arm can only hold 1 block at a time.`);
        }
        continue;
      }
      if (pos === b) {
        errors.push(`Block ${b} cannot be placed on top of itself.`);
        continue;
      }
      if (pos !== 'table' && !blocks.includes(pos)) {
        errors.push(`Block ${b} is placed on unknown target "${pos}".`);
        continue;
      }

      if (pos !== 'table') {
        if (supporting[pos]) {
          errors.push(`Block ${pos} already supports block ${supporting[pos]}; cannot also support block ${b}.`);
        }
        supporting[pos] = b;
      }
      supportedBy[b] = pos;
    }

    // Cycle detection & reachability to table
    for (const b of blocks) {
      if (placement[b] === 'hand' || !placement[b]) continue;
      const visited = new Set();
      let curr = b;
      let reachesTable = false;
      while (curr && curr !== 'table') {
        if (visited.has(curr)) {
          errors.push(`Circular stacking detected involving block ${curr}.`);
          break;
        }
        visited.add(curr);
        curr = supportedBy[curr];
        if (curr === 'table') {
          reachesTable = true;
          break;
        }
        if (!curr || placement[curr] === 'hand') {
          break;
        }
      }
      if (!reachesTable && !visited.has(curr) && placement[b] !== 'hand') {
        errors.push(`Block ${b} is floating without a solid path to the table.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: Array.from(new Set(errors))
    };
  }

  return {
    ACTIONS,
    normalizePredicate,
    parsePredicate,
    formatPredicate,
    parseAction,
    getActionDetails,
    cloneState,
    isSatisfied,
    areAllSatisfied,
    applyAction,
    arrangementToState,
    stateToArrangement,
    validateArrangement
  };
});
