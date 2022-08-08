import { task } from 'hardhat/config';
import { contractsDeployed, contractsDeployedOn } from './../scripts/utils/migrations';
import { LZ_CONFIG } from './helpers/constants';

let ethers: any;
let networkName: string;

const _getContract = async (contractName: string, signer: any, address?: string) => {
  const Contract = await ethers.getContractFactory(contractName);
  const instance = await Contract.attach(address || contractsDeployed[contractName]);

  return instance.connect(signer);
};

task('set-trusted-remote', 'sets trusted remote for OmniSBT on a destination chain').setAction(async ({}, hre) => {
  ethers = hre.ethers;
  networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();
  const { maxFeePerGas, maxPriorityFeePerGas } = await ethers.provider.getFeeData();

  if (!(LZ_CONFIG[networkName] && LZ_CONFIG[networkName].remote)) throw new Error('invalid network');

  const omniSBT = await _getContract('OmniSBT', deployer);

  console.log('setting trusted remote');
  const { remote } = LZ_CONFIG[networkName];
  console.log(`${remote}: ${LZ_CONFIG[remote].chainId}, ${contractsDeployedOn(remote).OmniSBT}`);
  const tx = await omniSBT.setTrustedRemote(LZ_CONFIG[remote].chainId, contractsDeployedOn(remote).OmniSBT);
  console.log(`tx: ${tx.hash}`);
  await tx.wait();
});
