export const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const LZ_SOURCE_CHAINS = ['mumbai', 'polygon'];
export const LZ_DESTINATION_CHAINS = ['fantom_testnet', 'fantom', 'goerli', 'optimismTestnet'];

// chainId: value not related to EVM IDs
// endpoint: LZEndpoint contract deployed on the network
// remote: the remote chain to be configured to send/receive messages from
export const LZ_CONFIG = {
  fantom_testnet: {
    chainId: '10012',
    endpoint: '0x7dcAD72640F835B0FA36EFD3D6d3ec902C7E5acf',
    remote: 'mumbai'
  },
  mumbai: {
    chainId: '10109',
    endpoint: '0xf69186dfBa60DdB133E91E9A4B5673624293d8F8',
    remotes: ['bsc_testnet']
  },
  bsc_testnet: {
    chainId: '10002',
    endpoint: '0x6Fcb97553D41516Cb228ac03FdC8B9a0a9df04A1',
    remote: 'mumbai'
  }
};

export const LZ_CONFIG_GATED_MODULES = {
  mumbai: {
    chainId: '10109',
    endpoint: '0xf69186dfBa60DdB133E91E9A4B5673624293d8F8',
    remotes: ['goerli', 'optimismTestnet']
  },
  goerli: {
    chainId: '10121',
    endpoint: '0xbfD2135BFfbb0B5378b56643c2Df8a87552Bfa23',
    remote: 'mumbai'
  },
  optimismTestnet: {
    chainId: '10132',
    endpoint: '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1',
    remote: 'mumbai'
  },
  // would need to add their hardhat plugin for deployment
  // zkSync_testnet: {
  //   chainId: '10147',
  //   endpoint: '0xeaa8d1D0E736C59F7F0211C272d25f7AEC9FCB51',
  //   remote: 'mumbai'
  // }
};

// @TODO: all the constants below should change per setup

// https://hq.decent.xyz/5/Editions/0xBbD9a6186C084F7148FA9787E94828faF769c9A3
export const TOKEN_CONTRACT = '0xBbD9a6186C084F7148FA9787E94828faF769c9A3'; // the ERC721 for token gate
export const TOKEN_THRESHOLD = '1'; // one token required to follow
export const TOKEN_CHAIN_ID = LZ_CONFIG_GATED_MODULES.goerli.chainId; // where our `TOKEN_CONTRACT` lives (goerli)

export const SANDBOX_USER_PROFILE_ID = '322'; // thereisnosecondbest2.test
export const SANDBOX_USER_PROFILE_ID_USER = '329'; // lenstestwalletuser.test
