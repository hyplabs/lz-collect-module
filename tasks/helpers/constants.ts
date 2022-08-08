export const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const LZ_SOURCE_CHAINS = ['mumbai', 'polygon'];
export const LZ_DESTINATION_CHAINS = ['fantom_testnet', 'fantom'];

export const LZ_CONFIG = {
  fantom_testnet: {
    chainId: '10012',
    endpoint: '0x7dcAD72640F835B0FA36EFD3D6d3ec902C7E5acf',
    remote: 'mumbai'
  },
  mumbai: {
    chainId: '10009',
    endpoint: '0xf69186dfBa60DdB133E91E9A4B5673624293d8F8',
    remotes: ['fantom_testnet']
  },
};
