import fs from 'fs';
import path from 'path';

const DEFAULT_NETWORK = 'hardhat';

// to support old way --network hardhat
const argValue = (arg, defaultValue) =>
  process.argv.includes(arg)
    ? process.argv[process.argv.indexOf(arg) + 1]
    : typeof defaultValue === 'function'
    ? defaultValue()
    : defaultValue;

const network = process.env.HARDHAT_NETWORK || argValue('--network', DEFAULT_NETWORK);
const CONTRACTS_PATH = `./${network}-contracts.json`;
const LENS_CONTRACTS_PATH = '../../../lens-protocol/addresses.json';
const contractsFile = () => path.join(__dirname, CONTRACTS_PATH);

export const contractsDeployed = JSON.parse(fs.readFileSync(contractsFile(), 'utf8'));

export const updateContractsDeployed = (contract, address, network = DEFAULT_NETWORK) => {
  const file = path.join(__dirname, `./${network}-contracts.json`);
  const contracts = JSON.parse(fs.readFileSync(file, 'utf8'));
  contracts[contract] = address;
  fs.writeFileSync(file, JSON.stringify(contracts, null, 2));
};

export const updateContractsDeployedLens = (contract, address) => {
  const file = path.join(__dirname, LENS_CONTRACTS_PATH);
  const contracts = JSON.parse(fs.readFileSync(file, 'utf8'));
  contracts[contract] = address;
  fs.writeFileSync(file, JSON.stringify(contracts, null, 2));
};

export const lensAddresses = JSON.parse(fs.readFileSync(path.join(__dirname, LENS_CONTRACTS_PATH), 'utf8'));
