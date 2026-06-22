#!/usr/bin/env node
// Set FORCE_COLOR before any chalk imports so color detection works correctly
// in the bundled binary. Respects NO_COLOR convention.
if (process.stdout.isTTY && !process.env.NO_COLOR) {
  process.env.FORCE_COLOR = process.env.FORCE_COLOR ?? '3';
}

import './cli.js';
