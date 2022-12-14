import { Context } from '@tenderly/actions';
import { Contract, providers, Wallet } from 'ethers';
import OmniSBT from './abi/OmniSBT.json';

const NETWORKS = {
  '80001': {
    name: 'maticmum',
    accessToken: 'ALCHEMY_ACCESS_TOKEN_MUMBAI'
  }
};

export const MUMBAI_OMNISBT_ADDRESS = '0x1a255753a44EEedbf6d3Afe65A8F006F8C513b0C';

export const getContract = async (context: Context, networkId: string) => {
  const accessToken = await context.secrets.get(NETWORKS[networkId].accessToken);

  const provider = new providers.AlchemyProvider(
    NETWORKS[networkId].name,
    accessToken
  );

  return new Contract(MUMBAI_OMNISBT_ADDRESS, OmniSBT.abi, provider);
};

export const getSignerStub = async (context: Context, provider: any) => {
  const privKey = await context.secrets.get('MUMBAI_LENS_GOVERNANCE_PRIV_KEY');

  return new Wallet(privKey, provider);
};
