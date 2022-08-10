import {
	ActionFn,
	Context,
	Event,
	TransactionEvent,
} from '@tenderly/actions';
import { utils } from 'ethers';
import { findLog } from './utils/utils';
import Events from './utils/abi/Events.json';
import { getContract, getSignerStub } from './utils/omniSBT';
import { estimateFee } from './utils/lz';

const LENS_HUB_PROXY = '0x60ae865ee4c725cd04353b5aab364553f56cef82';

// @TODO: set these after creating your post
const MUMBAI_HYPE_PROFILE_ID = '0x346f'; // https://testnet.lenster.xyz/u/carlosbeltran.test
const MUMBAI_HYPE_PUB_ID = '0x03'; // https://testnet.lenster.xyz/posts/0x346f-0x03

const MUMBAI_FIRST_COLLECTION_ID = 1;
const MUMBAI_FIRST_COLLECTION_CHAIN_ID = '10012'; // fantom_testnet

export const handler: ActionFn = async (context: Context, event: Event) => {
	const txEvent = event as TransactionEvent;

	const {
		collector,
		rootProfileId,
		rootPubId
	} = findLog(txEvent, LENS_HUB_PROXY, Events.abi, 'Collected').args;

	// the only profile/pub we care about
	if (rootProfileId.toHexString() === MUMBAI_HYPE_PROFILE_ID && rootPubId.toHexString() === MUMBAI_HYPE_PUB_ID) {
		// mint an OmniSBT for the collector
		const omniSBT = await getContract(context, txEvent.network);
		const signer = await getSignerStub(context, omniSBT.provider);

		const { maxFeePerGas, maxPriorityFeePerGas } = await omniSBT.provider.getFeeData();

		const [value] = await estimateFee(
			omniSBT.provider,
			txEvent.network,
			collector,
			MUMBAI_FIRST_COLLECTION_ID
		);
		console.log(`estimated fee (eth): ${utils.formatEther(value)}`);

		console.log('omniSBT.mint');
		const tx = await omniSBT.connect(signer).mint(
			collector,
			MUMBAI_FIRST_COLLECTION_ID,
			MUMBAI_FIRST_COLLECTION_CHAIN_ID,
			{ maxFeePerGas, maxPriorityFeePerGas, gasLimit: 1000000, value }
		);

		console.log(`not waiting - check: https://mumbai.polygonscan.com/tx/${tx.hash}`);
	}
};
