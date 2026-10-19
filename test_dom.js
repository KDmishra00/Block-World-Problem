const fs = require('fs');
const assert = require('assert');

console.log('--- RUNNING HTML & DOM INTEGRITY CHECKS ---');

const html = fs.readFileSync('index.html', 'utf8');
const appJs = fs.readFileSync('js/app.js', 'utf8');

// Extract all getElementById calls from app.js
const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const expectedIds = new Set();
while ((match = regex.exec(appJs)) !== null) {
  expectedIds.add(match[1]);
}

// Also check init_pos_${b} and goal_pos_${b}
for (const b of ['A', 'B', 'C', 'D']) {
  expectedIds.add(`init_pos_${b}`);
  expectedIds.add(`goal_pos_${b}`);
}

console.log(`Checking ${expectedIds.size} DOM IDs in index.html...`);

for (const id of expectedIds) {
  // Check if id exists in index.html
  const idRegex = new RegExp(`id=["']${id}["']`);
  assert(idRegex.test(html), `Missing ID in index.html: ${id}`);
  console.log(`✓ Verified element #${id}`);
}

// Verify script tags order in index.html
const stripsIdx = html.indexOf('src="strips.js"');
const plannerIdx = html.indexOf('src="planner.js"');
const appIdx = html.indexOf('src="app.js"');

assert(stripsIdx > -1, 'strips.js script tag missing');
assert(plannerIdx > stripsIdx, 'planner.js must load after strips.js');
assert(appIdx > plannerIdx, 'app.js must load after planner.js');
console.log('✓ Script loading order: strips.js -> planner.js -> app.js');

// Verify Sections A, B, C, D, E are present
assert(html.includes('Section A'), 'Section A label missing');
assert(html.includes('Section B'), 'Section B label missing');
assert(html.includes('Section C'), 'Section C label missing');
assert(html.includes('Section D'), 'Section D label missing');
assert(html.includes('Section E'), 'Section E label missing');
console.log('✓ All 5 Sections (A, B, C, D, E) present and labeled.');

console.log('\nALL HTML & DOM INTEGRITY CHECKS PASSED!\n');
