import { pathToFileURL } from 'url';
import path from 'path';

// Load runScenario14 from run-e2e.mjs by running only Senaryo 14
const runE2ePath = path.resolve('scripts/run-e2e.mjs');
// Let's create an isolated runner for scenario 14
