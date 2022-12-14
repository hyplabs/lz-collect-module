import { HardhatUserConfig } from 'hardhat/types';
import { accounts } from './tasks/helpers/lens'
import glob from 'glob';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@tenderly/hardhat-tenderly';
import '@typechain/hardhat';
import 'hardhat-deploy';
import 'hardhat-gas-reporter';
import 'hardhat-contract-sizer';
import 'hardhat-spdx-license-identifier';
import 'solidity-coverage';

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
    mainnet: {
      url: process.env.ALCHEMY_MAINNET_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY, ...lensTestWallets()]
    },
    polygon: {
      url: process.env.ALCHEMY_POLYGON_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY, ...lensTestWallets()]
    },
    mumbai: {
      url: process.env.ALCHEMY_MUMBAI_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY, ...lensTestWallets()]
    },
    fantom_testnet: {
      url: process.env.FANTOM_TESTNET_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY]
    },
    bsc_testnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      chainId: 97,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY]
    },
    goerli: {
      url: process.env.ALCHEMY_GOERLI_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY, ...lensTestWallets()]
    },
    optimismTestnet: {
      url: process.env.ALCHEMY_OPTIMISM_GOERLI_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY, ...lensTestWallets()],
      chainId: 420,
    },
    docker: {
      url: 'http://127.0.0.1:8545',
      accounts: lensTestWallets()
    }
  },
  spdxLicenseIdentifier: {
    overwrite: false,
    runOnCompile: false,
  },
  gasReporter: {
    enabled: (process.env.REPORT_GAS) ? true : false,
    currency: 'USD',
    token: 'MATIC',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    gasPrice: 45, // https://polygonscan.com/gastracker
    gasPriceApi: 'https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice'
  },
  etherscan: {
    apiKey: {
      polygonMumbai: process.env.ETHERSCAN_API_KEY
    }
  },
  tenderly: {
    project: process.env.TENDERLY_PROJECT,
    username: process.env.TENDERLY_USERNAME,
  },
};

export default config;
