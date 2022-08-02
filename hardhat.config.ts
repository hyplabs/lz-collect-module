import { HardhatUserConfig } from 'hardhat/types';
import { accounts } from './tasks/helpers/lens'
import glob from 'glob';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import '@nomiclabs/hardhat-ethers';
import '@typechain/hardhat';
import 'hardhat-deploy';

if (!process.env.SKIP_LOAD) {
  glob.sync('./tasks/**/*.ts').forEach(function (file) {
    require(path.resolve(file));
  });
}

const DEFAULT_BLOCK_GAS_LIMIT = 12450000;
const HARDHAT_CHAINID = 31337;
const SKALE_CHAINID_TESTNET = 1250011826715177;

const lensTestWallets = () => {
  const deployer = accounts[0].secretKey;
  const governance = accounts[1].secretKey;
  const user = accounts[3].secretKey;
  const sponsor = accounts[4].secretKey;

  return [deployer, governance, user, sponsor];
};

const settings = {
  optimizer: {
    enabled: true,
    runs: 200,
    details: {
      yul: true,
    },
  }
};

const config = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [
      {
        version: '0.8.10',
        settings
      }
    ],
  },
  paths: {
    artifacts: './build'
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
      1: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
    },
  },
  networks: {
    hardhat: {
      hardfork: 'london',
      blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
      gas: DEFAULT_BLOCK_GAS_LIMIT,
      gasPrice: 8000000000,
      chainId: HARDHAT_CHAINID,
      allowUnlimitedContractSize: true, // HACK: needed to run tests
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
    },
    mumbai: {
      url: process.env.ALCHEMY_MUMBAI_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY, ...lensTestWallets()]
    },
    docker: {
      url: 'http://127.0.0.1:8545',
      accounts: lensTestWallets()
    }
  }
};

export default config;
