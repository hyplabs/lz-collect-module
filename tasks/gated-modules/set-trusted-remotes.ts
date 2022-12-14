import { task } from 'hardhat/config';
import promiseLimit from 'promise-limit';
import { LZ_CONFIG_GATED_MODULES } from './../helpers/constants';
import getContract from './../helpers/getContract';
import { contractsDeployedOn } from './../../scripts/utils/migrations';

task('set-trusted-remotes', 'sets the trusted remotes for each module / remote pair').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  const limit = promiseLimit(1);

  if (!LZ_CONFIG_GATED_MODULES[networkName]) throw new Error('invalid network');

  const followModule = await getContract(ethers, 'LZGatedFollowModule', deployer);
  const referenceModule = await getContract(ethers, 'LZGatedReferenceModule', deployer);
  const collectModule = await getContract(ethers, 'LZGatedCollectModule', deployer);

  const { remotes } = LZ_CONFIG_GATED_MODULES[networkName];

  await Promise.all(remotes.map((remote) => limit(async () => {
    const { LZGatedProxy } = contractsDeployedOn(remote);

    if (!LZGatedProxy) throw new Error(`missing LZGatedProxy at remote: ${remote}`);

    console.log(`setting trusted remote (${LZ_CONFIG_GATED_MODULES[remote].chainId}, ${LZGatedProxy})`);

    let tx;
    tx = await followModule.setTrustedRemote(LZ_CONFIG_GATED_MODULES[remote].chainId, LZGatedProxy);
    console.log(`tx: ${tx.hash}`);
    await tx.wait();

    tx = await referenceModule.setTrustedRemote(LZ_CONFIG_GATED_MODULES[remote].chainId, LZGatedProxy);
    console.log(`tx: ${tx.hash}`);
    await tx.wait();

    tx = await collectModule.setTrustedRemote(LZ_CONFIG_GATED_MODULES[remote].chainId, LZGatedProxy);
    console.log(`tx: ${tx.hash}`);
    await tx.wait();
  })));

  console.log('done!');
});
