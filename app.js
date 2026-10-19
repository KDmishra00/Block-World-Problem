/**
 * Application Controller for Block World Planning Simulator
 * Handles UI interactions, rendering, presets, validation, plan generation,
 * step-by-step execution, and action inspection.
 */

(function () {
  'use strict';

  const BLOCKS = ['A', 'B', 'C', 'D'];

  // Presets
  const PRESETS = {
    sussman: {
      name: 'Sussman Anomaly (Classic Benchmark)',
      description: 'Initial: C on A, A & B on table. Goal: A on B, B on C. Tests resolving interacting subgoals.',
      initial: { A: 'table', B: 'table', C: 'A', D: 'table' },
      goal: { A: 'B', B: 'C', C: 'table', D: 'table' }
    },
    invert2: {
      name: 'Invert 2 Blocks (A on B → B on A)',
      description: 'Initial: A on B. Goal: B on A.',
      initial: { A: 'B', B: 'table', C: 'table', D: 'table' },
      goal: { A: 'table', B: 'A', C: 'table', D: 'table' }
    },
    tower3: {
      name: 'Build 3-Block Tower (A on B on C)',
      description: 'Initial: All blocks on table. Goal: Stack A on B on C.',
      initial: { A: 'table', B: 'table', C: 'table', D: 'table' },
      goal: { A: 'B', B: 'C', C: 'table', D: 'table' }
    },
    tower4: {
      name: '4-Block Tower Inversion (A-B-C-D → D-C-B-A)',
      description: 'Initial: A on B on C on D. Goal: D on C on B on A.',
      initial: { A: 'B', B: 'C', C: 'D', D: 'table' },
      goal: { D: 'C', C: 'B', B: 'A', A: 'table' }
    },
    clearAll: {
      name: 'Clear All Blocks to Table',
      description: 'Initial: Two 2-block stacks. Goal: Unstack all blocks onto the table.',
      initial: { A: 'B', B: 'table', C: 'D', D: 'table' },
      goal: { A: 'table', B: 'table', C: 'table', D: 'table' }
    }
  };

  // State Store
  const state = {
    initialPlacement: { ...PRESETS.sussman.initial },
    goalPlacement: { ...PRESETS.sussman.goal },
    currentPlacement: { ...PRESETS.sussman.initial },
    currentHolding: null, // block in robot arm, or null
    
    // Planning & Execution
    generatedPlan: [],
    planTrace: [],
    currentStepIndex: -1, // -1: not started, 0..N-1: current/last executed step
    isAutoExecuting: false,
    autoTimer: null,
    
    // UI selection
    selectedActionIndex: null
  };

  // DOM Elements Cache
  const els = {};

  function initElements() {
    els.presetSelect = document.getElementById('presetSelect');
    
    // Stages
    els.initialStage = document.getElementById('initialStage');
    els.goalStage = document.getElementById('goalStage');
    els.currentStage = document.getElementById('currentStage');
    
    // Predicates
    els.initialPreds = document.getElementById('initialPreds');
    els.goalPreds = document.getElementById('goalPreds');
    els.currentPreds = document.getElementById('currentPreds');
    
    // Arm indicator
    els.armStatusText = document.getElementById('armStatusText');
    els.armHoldingSlot = document.getElementById('armHoldingSlot');
    
    // Error banners
    els.initialError = document.getElementById('initialError');
    els.goalError = document.getElementById('goalError');
    els.generalError = document.getElementById('generalError');
    els.successBanner = document.getElementById('successBanner');
    
    // Dropdowns
    els.initialSelects = {};
    els.goalSelects = {};
    for (const b of BLOCKS) {
      els.initialSelects[b] = document.getElementById(`init_pos_${b}`);
      els.goalSelects[b] = document.getElementById(`goal_pos_${b}`);
    }

    // Controls
    els.btnGenerate = document.getElementById('btnGenerate');
    els.btnExecute = document.getElementById('btnExecute');
    els.btnNext = document.getElementById('btnNext');
    els.btnReset = document.getElementById('btnReset');
    
    // Progress
    els.progressDisplay = document.getElementById('progressDisplay');
    els.progressText = document.getElementById('progressText');
    els.actionHighlight = document.getElementById('actionHighlight');
    els.statusBadge = document.getElementById('statusBadge');
    
    // Plan table
    els.planTableBody = document.getElementById('planTableBody');
    els.planContainer = document.getElementById('planContainer');
    
    // Inspector
    els.inspectorTitle = document.getElementById('inspectorTitle');
    els.inspectorDesc = document.getElementById('inspectorDesc');
    els.inspectorPre = document.getElementById('inspectorPre');
    els.inspectorAdd = document.getElementById('inspectorAdd');
    els.inspectorDel = document.getElementById('inspectorDel');
  }

  /**
   * Calculate columns/stacks for a given placement
   * Returns array of stacks (each stack is an array of blocks from bottom to top)
   */
  function computeColumns(placement) {
    const tableBlocks = [];
    const onTopOf = {}; // under -> over

    for (const b of BLOCKS) {
      const pos = placement[b];
      if (pos === 'table') {
        tableBlocks.push(b);
      } else if (pos && pos !== 'hand') {
        onTopOf[pos] = b;
      }
    }

    // Sort table blocks alphabetically for stable display
    tableBlocks.sort();

    const stacks = [];
    for (const base of tableBlocks) {
      const stack = [base];
      let curr = base;
      while (onTopOf[curr]) {
        stack.push(onTopOf[curr]);
        curr = onTopOf[curr];
      }
      stacks.push(stack);
    }

    // Check for any floating blocks (isolated chains or broken supports)
    const placedBlocks = new Set();
    stacks.forEach(stk => stk.forEach(b => placedBlocks.add(b)));
    for (const b of BLOCKS) {
      if (!placedBlocks.has(b) && placement[b] !== 'hand') {
        stacks.push([b]);
      }
    }

    return stacks;
  }

  /**
   * Render a stage with blocks and table
   */
  function renderStage(container, placement, holdingBlock = null) {
    const stacks = computeColumns(placement);
    
    // Ensure we always have at least 4 visual slots on the table
    const totalSlots = Math.max(4, stacks.length);
    let html = '<div class="table-slots-container">';

    for (let i = 0; i < totalSlots; i++) {
      const stack = stacks[i] || [];
      html += '<div class="table-slot">';
      for (const b of stack) {
        html += `<div class="block block-${b.toLowerCase()}" title="Block ${b}">${b}</div>`;
      }
      html += '</div>';
    }

    html += '</div>';
    html += '<div class="table-surface-bar"></div>';
    html += '<div class="table-label">Table Surface</div>';

    container.innerHTML = html;
  }

  /**
   * Render predicates list as styled tags
   */
  function renderPredicates(container, predSet) {
    const preds = Array.from(predSet).sort();
    if (preds.length === 0) {
      container.innerHTML = '<span class="pred-tag" style="color:#94a3b8;">None</span>';
      return;
    }
    container.innerHTML = preds
      .map(p => `<span class="pred-tag">${p}</span>`)
      .join(' ');
  }

  /**
   * Update all dropdown selectors to match internal placement
   */
  function syncDropdowns() {
    for (const b of BLOCKS) {
      if (els.initialSelects[b]) {
        els.initialSelects[b].value = state.initialPlacement[b] || 'table';
      }
      if (els.goalSelects[b]) {
        els.goalSelects[b].value = state.goalPlacement[b] || 'table';
      }
    }
  }

  /**
   * Validate arrangements and update UI messages
   */
  function validateAll() {
    const initValidation = STRIPS.validateArrangement(BLOCKS, state.initialPlacement);
    if (!initValidation.valid) {
      els.initialError.textContent = '⚠️ ' + initValidation.errors.join(' ');
      els.initialError.style.display = 'flex';
      els.btnGenerate.disabled = true;
    } else {
      els.initialError.style.display = 'none';
    }

    const goalValidation = STRIPS.validateArrangement(BLOCKS, state.goalPlacement);
    if (!goalValidation.valid) {
      els.goalError.textContent = '⚠️ ' + goalValidation.errors.join(' ');
      els.goalError.style.display = 'flex';
      els.btnGenerate.disabled = true;
    } else {
      els.goalError.style.display = 'none';
    }

    if (initValidation.valid && goalValidation.valid) {
      els.btnGenerate.disabled = false;
    }

    return initValidation.valid && goalValidation.valid;
  }

  /**
   * Refresh all views: initial, goal, current, arm, predicates
   */
  function refreshView() {
    // 1. Initial State
    renderStage(els.initialStage, state.initialPlacement);
    const initPreds = STRIPS.arrangementToState(BLOCKS, state.initialPlacement);
    renderPredicates(els.initialPreds, initPreds);

    // 2. Goal State
    renderStage(els.goalStage, state.goalPlacement);
    const goalPreds = STRIPS.arrangementToState(BLOCKS, state.goalPlacement);
    renderPredicates(els.goalPreds, goalPreds);

    // 3. Current State
    renderStage(els.currentStage, state.currentPlacement, state.currentHolding);
    const currPreds = STRIPS.arrangementToState(BLOCKS, state.currentPlacement);
    renderPredicates(els.currentPreds, currPreds);

    // 4. Robot Arm
    if (state.currentHolding) {
      els.armStatusText.textContent = `HOLDING(${state.currentHolding})`;
      els.armHoldingSlot.innerHTML = `<div class="block mini-block block-${state.currentHolding.toLowerCase()}">${state.currentHolding}</div>`;
    } else {
      els.armStatusText.textContent = 'ARMEMPTY';
      els.armHoldingSlot.innerHTML = '<span style="color:#94a3b8;font-size:11px;">[Empty]</span>';
    }

    // 5. Dropdowns and validation
    syncDropdowns();
    validateAll();

    // 6. Update plan table and inspector
    renderPlanTable();
    updateControlsState();
  }

  /**
   * Load a preset configuration
   */
  function loadPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    
    stopAutoExecution();
    state.initialPlacement = { ...p.initial };
    state.goalPlacement = { ...p.goal };
    state.currentPlacement = { ...p.initial };
    state.currentHolding = null;
    
    state.generatedPlan = [];
    state.planTrace = [];
    state.currentStepIndex = -1;
    state.selectedActionIndex = null;

    hideBanners();
    refreshView();
  }

  function hideBanners() {
    els.generalError.style.display = 'none';
    els.successBanner.style.display = 'none';
  }

  /**
   * Generate Plan using Goal Stack Planner
   */
  function handleGeneratePlan() {
    stopAutoExecution();
    hideBanners();

    if (!validateAll()) {
      return;
    }

    // Reset current state to initial state before planning
    state.currentPlacement = { ...state.initialPlacement };
    state.currentHolding = null;
    state.currentStepIndex = -1;
    state.selectedActionIndex = null;

    const initState = STRIPS.arrangementToState(BLOCKS, state.initialPlacement);
    const goalState = STRIPS.arrangementToState(BLOCKS, state.goalPlacement);

    // Filter goal predicates to positive target goals (e.g. ON, ONTABLE)
    const goalPreds = Array.from(goalState).filter(p => {
      const parsed = STRIPS.parsePredicate(p);
      return parsed.name === 'ON' || parsed.name === 'ONTABLE';
    });

    const result = GoalStackPlanner.generateAndVerifyPlan(initState, goalPreds, BLOCKS);

    if (!result.success) {
      els.generalError.textContent = `⚠️ Planner could not produce a valid plan: ${result.error}`;
      els.generalError.style.display = 'flex';
      state.generatedPlan = [];
      state.planTrace = [];
      refreshView();
      return;
    }

    state.generatedPlan = result.plan;
    state.planTrace = result.trace;

    if (state.generatedPlan.length === 0) {
      els.successBanner.textContent = '✓ Initial state already matches the Goal state! No actions required.';
      els.successBanner.style.display = 'flex';
    }

    // Automatically inspect first step
    if (state.planTrace.length > 0) {
      state.selectedActionIndex = 0;
      inspectAction(state.planTrace[0]);
    }

    refreshView();
  }

  /**
   * Execute single step
   */
  function handleNextStep() {
    hideBanners();
    if (state.generatedPlan.length === 0) {
      return;
    }

    const nextIndex = state.currentStepIndex + 1;
    if (nextIndex >= state.generatedPlan.length) {
      checkGoalCompletion();
      return;
    }

    const actionStr = state.generatedPlan[nextIndex];
    const traceItem = state.planTrace[nextIndex];

    try {
      // Current state to STRIPS set
      let currSet = STRIPS.arrangementToState(BLOCKS, state.currentPlacement);
      currSet = STRIPS.applyAction(currSet, actionStr, true);

      // Convert back to arrangement
      const newArr = STRIPS.stateToArrangement(BLOCKS, currSet);
      state.currentPlacement = newArr.placement;
      state.currentHolding = newArr.holding;
      state.currentStepIndex = nextIndex;
      state.selectedActionIndex = nextIndex;

      inspectAction(traceItem);
      refreshView();

      // Check if finished
      if (state.currentStepIndex === state.generatedPlan.length - 1) {
        checkGoalCompletion();
      }
    } catch (err) {
      stopAutoExecution();
      els.generalError.textContent = `⚠️ Execution Error: ${err.message}`;
      els.generalError.style.display = 'flex';
    }
  }

  /**
   * Auto execute remaining plan
   */
  function handleExecutePlan() {
    if (state.isAutoExecuting) {
      stopAutoExecution();
      return;
    }

    if (state.currentStepIndex >= state.generatedPlan.length - 1) {
      // If already at end, reset and execute from beginning
      handleReset();
    }

    state.isAutoExecuting = true;
    els.btnExecute.textContent = '⏸ Pause Execution';
    els.btnExecute.classList.remove('btn-success');
    els.btnExecute.classList.add('btn-secondary');

    runAutoStep();
  }

  function runAutoStep() {
    if (!state.isAutoExecuting) return;

    if (state.currentStepIndex < state.generatedPlan.length - 1) {
      handleNextStep();
      state.autoTimer = setTimeout(runAutoStep, 700);
    } else {
      stopAutoExecution();
    }
  }

  function stopAutoExecution() {
    if (state.autoTimer) {
      clearTimeout(state.autoTimer);
      state.autoTimer = null;
    }
    state.isAutoExecuting = false;
    if (els.btnExecute) {
      els.btnExecute.textContent = '▶ Execute Plan';
      els.btnExecute.classList.remove('btn-secondary');
      els.btnExecute.classList.add('btn-success');
    }
  }

  /**
   * Reset execution back to initial state
   */
  function handleReset() {
    stopAutoExecution();
    hideBanners();

    state.currentPlacement = { ...state.initialPlacement };
    state.currentHolding = null;
    state.currentStepIndex = -1;
    if (state.planTrace.length > 0) {
      state.selectedActionIndex = 0;
      inspectAction(state.planTrace[0]);
    }
    refreshView();
  }

  /**
   * Verify actual final state against goal conditions
   */
  function checkGoalCompletion() {
    stopAutoExecution();
    const currState = STRIPS.arrangementToState(BLOCKS, state.currentPlacement);
    const goalState = STRIPS.arrangementToState(BLOCKS, state.goalPlacement);

    const goalPreds = Array.from(goalState).filter(p => {
      const parsed = STRIPS.parsePredicate(p);
      return parsed.name === 'ON' || parsed.name === 'ONTABLE';
    });

    const isSatisfied = STRIPS.areAllSatisfied(currState, goalPreds);
    if (isSatisfied) {
      els.successBanner.textContent = '✓ Plan Execution Complete: World state successfully satisfies all goal conditions!';
      els.successBanner.style.display = 'flex';
    } else {
      els.generalError.textContent = '⚠️ Plan finished, but the final world state does not match all goal requirements.';
      els.generalError.style.display = 'flex';
    }
  }

  /**
   * Render generated plan table
   */
  function renderPlanTable() {
    if (state.generatedPlan.length === 0) {
      els.planTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color:#94a3b8; padding: 20px;">
            No plan generated yet. Click "Generate Plan" above.
          </td>
        </tr>`;
      return;
    }

    let html = '';
    state.planTrace.forEach((step, idx) => {
      let rowClass = '';
      let statusBadge = '<span class="status-badge" style="background:#f1f5f9;color:#64748b;">Pending</span>';

      if (idx < state.currentStepIndex) {
        rowClass = 'completed-step';
        statusBadge = '<span class="status-badge" style="background:#dcfce7;color:#16a34a;">Done ✓</span>';
      } else if (idx === state.currentStepIndex) {
        rowClass = 'active-step';
        statusBadge = '<span class="status-badge" style="background:#bfdbfe;color:#1e40af;">Active</span>';
      }

      const isInspected = idx === state.selectedActionIndex;
      const borderStyle = isInspected ? 'outline: 2px solid var(--primary-blue);' : '';

      html += `
        <tr class="${rowClass}" style="${borderStyle}" onclick="window.App.selectAction(${idx})">
          <td><strong>#${step.stepNumber}</strong></td>
          <td><code style="font-weight:700; color:var(--primary-blue);">${step.action}</code></td>
          <td>${step.description}</td>
          <td>${statusBadge}</td>
        </tr>`;
    });

    els.planTableBody.innerHTML = html;
  }

  /**
   * Action Inspector
   */
  function inspectAction(traceItem) {
    if (!traceItem) return;
    els.inspectorTitle.textContent = traceItem.action;
    els.inspectorDesc.textContent = traceItem.description;

    els.inspectorPre.innerHTML = traceItem.preconditions
      .map(p => `<span class="pred-tag">${p}</span>`)
      .join(' ') || '<span style="color:#94a3b8;font-size:11px;">None</span>';

    els.inspectorAdd.innerHTML = traceItem.addList
      .map(p => `<span class="pred-tag" style="background:#ecfdf5;border-color:#a7f3d0;color:#065f46;">+ ${p}</span>`)
      .join(' ') || '<span style="color:#94a3b8;font-size:11px;">None</span>';

    els.inspectorDel.innerHTML = traceItem.deleteList
      .map(p => `<span class="pred-tag" style="background:#fef2f2;border-color:#fecaca;color:#991b1b;">- ${p}</span>`)
      .join(' ') || '<span style="color:#94a3b8;font-size:11px;">None</span>';
  }

  /**
   * Update Controls & Progress Display
   */
  function updateControlsState() {
    const hasPlan = state.generatedPlan.length > 0;
    const isAtEnd = state.currentStepIndex >= state.generatedPlan.length - 1;

    els.btnExecute.disabled = !hasPlan;
    els.btnNext.disabled = !hasPlan || isAtEnd;
    els.btnReset.disabled = !hasPlan && state.currentStepIndex === -1;

    // Progress text
    if (!hasPlan) {
      els.progressText.textContent = 'Plan not generated';
      els.actionHighlight.textContent = 'None';
      els.statusBadge.textContent = 'IDLE';
      els.statusBadge.className = 'status-badge idle';
    } else if (state.currentStepIndex === -1) {
      els.progressText.textContent = `Ready (0 of ${state.generatedPlan.length} steps)`;
      els.actionHighlight.textContent = state.generatedPlan[0];
      els.statusBadge.textContent = 'READY';
      els.statusBadge.className = 'status-badge running';
    } else if (isAtEnd) {
      els.progressText.textContent = `Completed (${state.generatedPlan.length} of ${state.generatedPlan.length} steps)`;
      els.actionHighlight.textContent = state.generatedPlan[state.currentStepIndex];
      els.statusBadge.textContent = 'COMPLETED';
      els.statusBadge.className = 'status-badge complete';
    } else {
      els.progressText.textContent = `Step ${state.currentStepIndex + 1} of ${state.generatedPlan.length}`;
      els.actionHighlight.textContent = state.generatedPlan[state.currentStepIndex];
      els.statusBadge.textContent = 'IN PROGRESS';
      els.statusBadge.className = 'status-badge running';
    }
  }

  /**
   * Handle dropdown change for initial or goal states
   */
  function handleDropdownChange(type, block, value) {
    stopAutoExecution();
    hideBanners();

    if (type === 'init') {
      state.initialPlacement[block] = value;
      state.currentPlacement = { ...state.initialPlacement };
      state.currentHolding = null;
    } else {
      state.goalPlacement[block] = value;
    }

    state.generatedPlan = [];
    state.planTrace = [];
    state.currentStepIndex = -1;
    state.selectedActionIndex = null;

    refreshView();
  }

  /**
   * Public hook for selecting an action row in the plan table
   */
  function selectAction(index) {
    if (state.planTrace[index]) {
      state.selectedActionIndex = index;
      inspectAction(state.planTrace[index]);
      renderPlanTable();
    }
  }

  /**
   * Initialize App
   */
  function init() {
    initElements();

    // Preset selection event
    els.presetSelect.addEventListener('change', (e) => {
      loadPreset(e.target.value);
    });

    // Dropdown events
    for (const b of BLOCKS) {
      els.initialSelects[b].addEventListener('change', (e) => {
        handleDropdownChange('init', b, e.target.value);
      });
      els.goalSelects[b].addEventListener('change', (e) => {
        handleDropdownChange('goal', b, e.target.value);
      });
    }

    // Button events
    els.btnGenerate.addEventListener('click', handleGeneratePlan);
    els.btnExecute.addEventListener('click', handleExecutePlan);
    els.btnNext.addEventListener('click', handleNextStep);
    els.btnReset.addEventListener('click', handleReset);

    // Initial preset load
    loadPreset('sussman');
  }

  // Expose global controller for table row clicks
  window.App = {
    init,
    selectAction
  };

  document.addEventListener('DOMContentLoaded', init);
})();
