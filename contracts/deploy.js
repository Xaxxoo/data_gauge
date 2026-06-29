/**
 * Deploy DataGaugeCredits to Celo mainnet.
 *
 * Usage:
 *   cd contracts
 *   npm install
 *   node deploy.js
 *
 * Required .env (in contracts/ folder):
 *   AGENT_PRIVATE_KEY=0x...   (your deployer / agent wallet private key)
 *
 * After deploy, copy the printed contract address into the root .env:
 *   EXPO_PUBLIC_CREDITS_CONTRACT=0x...
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const GD_TOKEN    = '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A'; // G$ on Celo mainnet
const CELO_RPC    = 'https://forno.celo.org';

async function main() {
  if (!process.env.AGENT_PRIVATE_KEY) {
    throw new Error('AGENT_PRIVATE_KEY not set. Add it to contracts/.env');
  }

  const provider = new ethers.JsonRpcProvider(CELO_RPC);
  const wallet   = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);

  console.log('Deployer / agent wallet:', wallet.address);
  const celoBalance = await provider.getBalance(wallet.address);
  console.log('CELO balance:', ethers.formatEther(celoBalance), 'CELO');

  if (celoBalance < ethers.parseEther('0.01')) {
    throw new Error('Insufficient CELO for gas. Need at least 0.01 CELO.');
  }

  // Read compiled artifacts
  const abiPath      = path.join(__dirname, 'build', 'DataGaugeCredits.abi.json');
  const bytecodePath = path.join(__dirname, 'build', 'DataGaugeCredits.bytecode.txt');

  if (!fs.existsSync(abiPath) || !fs.existsSync(bytecodePath)) {
    throw new Error('Build artifacts not found. Run: node compile.js first.');
  }

  const abi      = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  const bytecode = fs.readFileSync(bytecodePath, 'utf8').trim();

  console.log('\nDeploying DataGaugeCredits...');
  const factory  = new ethers.ContractFactory(abi, bytecode, wallet);

  // agentWallet = deployer wallet (receives G$ when users spend credits)
  const contract = await factory.deploy(GD_TOKEN, wallet.address);
  console.log('Tx sent:', contract.deploymentTransaction().hash);
  console.log('Waiting for confirmation...');

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log('\n✅ DataGaugeCredits deployed to:', address);
  console.log('CeloScan:', `https://celoscan.io/address/${address}`);

  // Update root .env
  const rootEnvPath = path.join(__dirname, '..', '.env');
  let rootEnv = fs.existsSync(rootEnvPath) ? fs.readFileSync(rootEnvPath, 'utf8') : '';
  rootEnv = rootEnv
    .split('\n')
    .filter(l => !l.startsWith('EXPO_PUBLIC_CREDITS_CONTRACT='))
    .join('\n')
    .trim();
  rootEnv += `\nEXPO_PUBLIC_CREDITS_CONTRACT=${address}\n`;
  fs.writeFileSync(rootEnvPath, rootEnv);

  console.log('\nSaved EXPO_PUBLIC_CREDITS_CONTRACT to root .env');
  console.log('Rebuild and redeploy the app for the change to take effect.');
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err.message);
  process.exit(1);
});
