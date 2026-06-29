/**
 * Compile DataGaugeCredits.sol using solc.
 * Outputs ABI + bytecode to contracts/build/
 *
 * Usage:
 *   cd contracts
 *   npm install
 *   node compile.js
 */

const solc = require('solc');
const fs   = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'DataGaugeCredits.sol'), 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'DataGaugeCredits.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

const errors = (output.errors ?? []).filter(e => e.severity === 'error');
if (errors.length) {
  console.error('Compilation errors:');
  errors.forEach(e => console.error(e.formattedMessage));
  process.exit(1);
}

const warnings = (output.errors ?? []).filter(e => e.severity === 'warning');
warnings.forEach(w => console.warn('[warning]', w.formattedMessage));

const contract = output.contracts['DataGaugeCredits.sol']['DataGaugeCredits'];
const buildDir = path.join(__dirname, 'build');
fs.mkdirSync(buildDir, { recursive: true });

fs.writeFileSync(
  path.join(buildDir, 'DataGaugeCredits.abi.json'),
  JSON.stringify(contract.abi, null, 2)
);
fs.writeFileSync(
  path.join(buildDir, 'DataGaugeCredits.bytecode.txt'),
  '0x' + contract.evm.bytecode.object
);

console.log('✅ Compiled successfully. Artifacts saved to contracts/build/');
