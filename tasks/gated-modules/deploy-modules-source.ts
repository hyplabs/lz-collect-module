import { task } from 'hardhat/config';
import { LZ_CONFIG_GATED_MODULES } from './../helpers/constants';
import deployContract from './../helpers/deployContract';
import { getLensHubDeployed } from './../helpers/lens';
import getContract from './../helpers/getContract';

task('deploy-modules-source', 'deploys our Lens modules on the source chain').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer, governance] = await ethers.getSigners();

  if (!LZ_CONFIG_GATED_MODULES[networkName]) throw new Error('invalid network');

  // using the sandbox deployment for module whitelisting
  const lensHub = await getLensHubDeployed('lensHub sandbox', networkName, governance.provider);

  // const followModule = await deployContract(
  //   ethers,
  //   networkName,
  //   'LZGatedFollowModule',
  //   [lensHub.address, LZ_CONFIG_GATED_MODULES[networkName].endpoint, [], []]
  // );
  //
  // const referenceModule = await deployContract(
  //   ethers,
  //   networkName,
  //   'LZGatedReferenceModule',
  //   [lensHub.address, LZ_CONFIG_GATED_MODULES[networkName].endpoint, [], []]
  // );
  //
  // const collectModule = await deployContract(
  //   ethers,
  //   networkName,
  //   'LZGatedCollectModule',
  //   [lensHub.address, LZ_CONFIG_GATED_MODULES[networkName].endpoint, [], []]
  // );

  const followModule = await getContract(ethers, 'LZGatedFollowModule', deployer);
  const referenceModule = await getContract(ethers, 'LZGatedReferenceModule', deployer);
  const collectModule = await getContract(ethers, 'LZGatedCollectModule', deployer);

  console.log(await governance.getAddress());
  let tx;
  console.log('lensHub.whitelistFollowModule()');
  tx = await lensHub.connect(governance).whitelistFollowModule(followModule.address, true, { gasLimit: 50000 });
  await tx.wait();

  console.log('lensHub.whitelistReferenceModule()');
  tx = await lensHub.connect(governance).whitelistReferenceModule(referenceModule.address, true, { gasLimit: 50000 });
  await tx.wait();

  console.log('lensHub.whitelistCollectModule()');
  tx = await lensHub.connect(governance).whitelistCollectModule(collectModule.address, true, { gasLimit: 50000 });
  await tx.wait();
});
