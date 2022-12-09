import '@nomiclabs/hardhat-ethers';
import { BigNumberish, Bytes, logger, utils, BigNumber, Contract, Signer, VoidSigner } from 'ethers';
import {
  eventsLib,
  helper,
  lensHub,
  LENS_HUB_NFT_NAME,
  lensPeriphery,
  LENS_PERIPHERY_NAME,
  testWallet,
  user,
} from '../__setup.spec';
import { expect } from 'chai';
import { HARDHAT_CHAINID, MAX_UINT256 } from './constants';
import { BytesLike, hexlify, keccak256, RLP, toUtf8Bytes } from 'ethers/lib/utils';
import { TransactionReceipt, TransactionResponse } from '@ethersproject/providers';
import hre, { ethers } from 'hardhat';
import { readFileSync } from 'fs';
import { join } from 'path';

import { LensHub__factory } from '../../../typechain-types-lens';

export enum ProtocolState {
  Unpaused,
  PublishingPaused,
  Paused,
}

export function computeContractAddress(deployerAddress: string, nonce: number): string {
  const hexNonce = hexlify(nonce);
  return '0x' + keccak256(RLP.encode([deployerAddress, hexNonce])).substr(26);
}

export function getChainId(): number {
  return hre.network.config.chainId || HARDHAT_CHAINID;
}

export function getAbbreviation(handle: string) {
  let slice = handle.substr(0, 4);
  if (slice.charAt(3) == ' ') {
    slice = slice.substr(0, 3);
  }
  return slice;
}

export async function waitForTx(
  tx: Promise<TransactionResponse> | TransactionResponse,
  skipCheck = false
): Promise<TransactionReceipt> {
  if (!skipCheck) await expect(tx).to.not.be.reverted;
  return await (await tx).wait();
}

export async function getBlockNumber(): Promise<number> {
  return (await helper.getBlockNumber()).toNumber();
}

export async function resetFork(): Promise<void> {
  await hre.network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.MAINNET_RPC_URL,
          blockNumber: 12012081,
        },
      },
    ],
  });
  console.log('\t> Fork reset');

  await hre.network.provider.request({
    method: 'evm_setNextBlockTimestamp',
    params: [1614290545], // Original block timestamp + 1
  });

  console.log('\t> Timestamp reset to 1614290545');
}

export async function getTimestamp(): Promise<any> {
  const blockNumber = await hre.ethers.provider.send('eth_blockNumber', []);
  const block = await hre.ethers.provider.send('eth_getBlockByNumber', [blockNumber, false]);
  return block.timestamp;
}

export async function setNextBlockTimestamp(timestamp: number): Promise<void> {
  await hre.ethers.provider.send('evm_setNextBlockTimestamp', [timestamp]);
}

export async function mine(blocks: number): Promise<void> {
  for (let i = 0; i < blocks; i++) {
    await hre.ethers.provider.send('evm_mine', []);
  }
}

let snapshotId: string = '0x1';
export async function takeSnapshot() {
  snapshotId = await hre.ethers.provider.send('evm_snapshot', []);
}

export async function revertToSnapshot() {
  await hre.ethers.provider.send('evm_revert', [snapshotId]);
}

export async function getFollowWithSigParts(
  wallet: VoidSigner,
  profileIds: string[] | number[],
  datas: Bytes[] | string[],
  nonce: number,
  deadline: string
): Promise<{ v: number; r: string; s: string }> {
  const msgParams = buildFollowWithSigParams(profileIds, datas, nonce, deadline);
  return await getSig(wallet, msgParams);
}

async function getSig(wallet: VoidSigner, msgParams: {
  domain: any;
  types: any;
  value: any;
}): Promise<{ v: number; r: string; s: string }> {
  const sig = await wallet._signTypedData(msgParams.domain, msgParams.types, msgParams.value);
  return utils.splitSignature(sig);
}

const buildFollowWithSigParams = (
  profileIds: string[] | number[],
  datas: Bytes[] | string[],
  nonce: number,
  deadline: string
) => ({
  types: {
    FollowWithSig: [
      { name: 'profileIds', type: 'uint256[]' },
      { name: 'datas', type: 'bytes[]' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  domain: domain(),
  value: {
    profileIds: profileIds,
    datas: datas,
    nonce: nonce,
    deadline: deadline,
  },
});

function domain(): { name: string; version: string; chainId: number; verifyingContract: string } {
  return {
    name: LENS_HUB_NFT_NAME,
    version: '1',
    chainId: getChainId(),
    verifyingContract: lensHub.address,
  };
}
