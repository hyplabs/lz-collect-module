import {  Contract, Signer } from "ethers";
import LensHub from './abi/LensHub.json';

const lensAddresses = {
  'mumbai': {
    'interaction logic lib': '0xefd400326635e016CbfCc309725D5B62FD9d3468',
    'lensHub proxy': '0x60Ae865ee4C725cd04353b5AAb364553f56ceF82',
    'lensHub sandbox': '0x7582177F9E536aB0b6c721e11f383C326F2Ad1D5',
  }
};

const collectAbi = [
  "function collect(uint256 profileId, uint256 pubId, bytes calldata data) external returns (uint256)"
];

export const getLensHub = async (key: string = 'lensHub proxy', provider: any, networkName: string = 'mumbai') => (
  new Contract(lensAddresses[networkName][key], collectAbi, provider)
);

export const getLensHubDeployed = async (key: string = 'lensHub proxy', signer: Signer, networkName: string = 'mumbai') => {
  const contract = new Contract(lensAddresses[networkName][key], LensHub.abi, signer.provider);

  return contract.connect(signer);
};

// testnet accounts
export const accounts = [
  { secretKey: '0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122' },
  { secretKey: '0xd49743deccbccc5dc7baa8e69e5be03298da8688a15dd202e20f15d5e0e9a9fb' },
  { secretKey: '0x23c601ae397441f3ef6f1075dcb0031ff17fb079837beadaf3c84d96c6f3e569' },
  { secretKey: '0xee9d129c1997549ee09c0757af5939b2483d80ad649a0eda68e8b0357ad11131' },
  { secretKey: '0x87630b2d1de0fbd5044eb6891b3d9d98c34c8d310c852f98550ba774480e47cc' },
  { secretKey: '0x275cc4a2bfd4f612625204a20a2280ab53a6da2d14860c47a9f5affe58ad86d4' },
  { secretKey: '0xaee25d55ce586148a853ca83fdfacaf7bc42d5762c6e7187e6f8e822d8e6a650' },
  { secretKey: '0xa2e0097c961c67ec197b6865d7ecea6caffc68ebeb00e6050368c8f67fc9c588' },
];
