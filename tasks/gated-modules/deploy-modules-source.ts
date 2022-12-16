import { task } from 'hardhat/config';
import { LZ_CONFIG_GATED_MODULES } from './../helpers/constants';
import deployContract from './../helpers/deployContract';
import { getLensHubDeployed, getMockSandboxGovernance } from './../helpers/lens';
import getContract from './../helpers/getContract';

task('deploy-modules-source', 'deploys our Lens modules on the source chain').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  if (!LZ_CONFIG_GATED_MODULES[networkName]) throw new Error('invalid network');

  const key = networkName === 'mumbai' ? 'lensHub sandbox' : 'lensHub proxy'; // using sandbox for module whitelisting
  const lensHub = getLensHubDeployed(key, networkName, deployer.provider);

  const followModule = await deployContract(
    ethers,
    networkName,
    'LZGatedFollowModule',
    [lensHub.address, LZ_CONFIG_GATED_MODULES[networkName].endpoint, [], []]
  );

  const referenceModule = await deployContract(
    ethers,
    networkName,
    'LZGatedReferenceModule',
    [lensHub.address, LZ_CONFIG_GATED_MODULES[networkName].endpoint, [], []]
  );

  const collectModule = await deployContract(
    ethers,
    networkName,
    'LZGatedCollectModule',
    [lensHub.address, LZ_CONFIG_GATED_MODULES[networkName].endpoint, [], []]
  );

  if (networkName === 'mumbai') {
    const mockSandboxGovernance = getMockSandboxGovernance(deployer.provider);
    console.log(`whitelisting modules through mock sandbox governance: ${mockSandboxGovernance.address}`);

    let tx;
    console.log('mockSandboxGovernance.whitelistFollowModule()');
    tx = await mockSandboxGovernance.connect(deployer).whitelistFollowModule(followModule.address, true, { gasLimit: 100000 });
    console.log(`tx: ${tx.hash}`);
    await tx.wait();

    console.log('mockSandboxGovernance.whitelistReferenceModule()');
    tx = await mockSandboxGovernance.connect(deployer).whitelistReferenceModule(referenceModule.address, true, { gasLimit: 100000 });
    console.log(`tx: ${tx.hash}`);
    await tx.wait();

    console.log('mockSandboxGovernance.whitelistCollectModule()');
    tx = await mockSandboxGovernance.connect(deployer).whitelistCollectModule(collectModule.address, true, { gasLimit: 100000 });
    console.log(`tx: ${tx.hash}`);
    await tx.wait();
  }
});
