#!/usr/bin/env node
// Minimal no-op generate-environment script.
// Some CI/CD setups run a prebuild step to generate runtime config.
// For local builds we provide a safe no-op so the build can proceed.
try {
  console.log('generate-environment: no environment generation required; running no-op.');
  process.exit(0);
} catch (err) {
  console.error('generate-environment error:', err);
  process.exit(1);
}
