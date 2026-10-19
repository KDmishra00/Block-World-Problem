# Block World Planning Simulator (STRIPS & Goal Stack Planning)

An interactive, minimalist, and demonstration-ready **Artificial Intelligence Mini-Project** demonstrating classical automated planning in the Blocks World domain using the **STRIPS formalism** and **Goal Stack Planning algorithm**.

---

## 📌 Project Overview

In Artificial Intelligence, the **Blocks World** is a classic problem space for testing automated reasoning and planning algorithms. The agent controls a robot arm to rearrange labeled blocks (`A`, `B`, `C`, `D`) from a given **Initial State** to a specified **Goal State**.

### Key AI Concepts Demonstrated:
1. **STRIPS Formalism (Stanford Research Institute Problem Solver)**:
   - **Predicates**: `ON(x, y)`, `ONTABLE(x)`, `CLEAR(x)`, `HOLDING(x)`, `ARMEMPTY`
   - **Operators**: `PICKUP(x)`, `PUTDOWN(x)`, `UNSTACK(x, y)`, `STACK(x, y)`
   - Each action has strictly defined **Preconditions**, **Add Effects**, and **Delete Effects**.
2. **Goal Stack Planning**:
   - Stack-based decomposition of compound goals into individual subgoals and operators.
   - Genuine handling of interacting subgoals and goal clobbering (including the famous **Sussman Anomaly**).
   - Safeguards against infinite loops, recursive cycles, and unreachable goals.
3. **Forward Simulation Verification**:
   - Before presenting the plan, the engine simulates execution step-by-step to guarantee that every precondition is satisfied and the final world state matches all target predicates.

---

## 🚀 How to Run the Project

This application is built with standard web technologies (HTML5, Vanilla CSS, and modern JavaScript) and requires **no external dependencies or build tools**.

### Method 1: Direct Browser Launch
Simply open `index.html` directly in any modern web browser (Chrome, Firefox, Safari, Edge):
```bash
# macOS
open index.html

# Linux
xdg-open index.html
```

### Method 2: Local HTTP Server (Optional)
Using Python or Node.js:
```bash
# Using Python
python3 -m http.server 3000

# Using npx serve
npx -y serve .
```
Then visit `http://localhost:3000` in your browser.

---

## 🧪 Automated Testing

To run the automated verification suite for the STRIPS engine and Goal Stack Planner:
```bash
node tests/test_planner.js
```
The test suite verifies:
- Predicate derivation and arrangement validation (rejecting cycles, multiple supports, floating blocks).
- Simple 2-block inversion.
- Sussman Anomaly (achieving optimal 6-step solution).
- 3-block and 4-block tower synthesis.
- Precondition enforcement and simulation verification.

---

## 🧭 Demonstrating to Faculty (Step-by-Step Guide)

1. **Step 1: Load a Benchmark Preset**
   - In the top-right toolbar, select **"Sussman Anomaly (Interacting Subgoals)"**.
   - Notice how Section A (Initial State) displays `C on A` with `A` and `B` on the table.
   - Section B (Goal State) displays the target tower: `A on B`, `B on C`.
2. **Step 2: Generate Plan**
   - Click the blue **"⚡ Generate Plan"** button.
   - Section D populates with the synthesized action sequence.
3. **Step 3: Inspect Operators**
   - Click on any action step in the table (e.g., `UNSTACK(C, A)` or `STACK(B, C)`).
   - The **STRIPS Action Inspector** immediately shows the mathematical Preconditions, Add Effects, and Delete Effects.
4. **Step 4: Step-by-Step Execution**
   - Click **"&rarr; Next Step"** to execute actions one by one.
   - Watch Section C (Current State) dynamically update the blocks and the Robot Arm status (`ARMEMPTY` vs. `HOLDING(x)`).
5. **Step 5: Automatic Plan Execution**
   - Click **"▶ Execute Plan"** to watch the remaining steps execute smoothly.
   - Upon completion, the simulator verifies the final state against the goal and displays the green confirmation badge.
6. **Step 6: Custom Configurations & Validation**
   - Use the dropdown selectors under Section A or Section B to test custom arrangements.
   - Notice that invalid states (e.g. setting A on B and B on A) immediately show an understandable error message and prevent invalid planning.

---

## 📂 Project Architecture

```
AI project/
├── index.html            # Clean, minimalist light-mode user interface
├── css/
│   └── style.css         # Minimalist stylesheet (light-mode only, crisp panels)
├── js/
│   ├── strips.js         # STRIPS logic, predicates, actions, and validation
│   ├── planner.js        # Goal Stack Planning algorithm and simulation verifier
│   └── app.js            # UI controller, state management, and execution runner
├── tests/
│   └── test_planner.js   # Automated Node.js test suite for verification
└── README.md             # Project documentation and faculty demonstration guide
```

---

## 🎓 Academic Concepts Reference

| Concept | Description |
|---|---|
| **Initial State** | Conjunction of starting assertions describing the table and block locations. |
| **Goal State** | Desired state assertions that must hold true upon plan completion. |
| **Preconditions** | Facts that must be true in the world before an operator can be executed. |
| **Add Effects** | Facts made true as a result of executing the operator. |
| **Delete Effects** | Facts that cease to be true once the operator is executed. |
| **Sussman Anomaly** | A classic AI planning scenario where subgoals are non-linear; achieving one subgoal directly can destroy the preconditions for another, requiring the planner to interleave unstacking actions. |
