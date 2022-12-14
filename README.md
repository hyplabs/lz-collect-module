# lz-collect-module

`LZCollectModule` is a Lens Collect Module that allows creators to mint soulbound NFTs (OmniSBT) for their followers that are cross-chain compatible, via LayerZero.
- a creator attaches this module to one of their posts and specifies parameters such as the destination chain id
- any user that collects the post gets an OmniSBT minted on the destination chain

`LZGatedFollowModule` is a Lens Follow Module that allows profile holders to gate their following with ERC20 or ERC721 balances held on other chains
- a profile initializes this module with a supported LayerZero chain id and a ERC20/ERC721 contract + balance to check against
- another user wishes to follow, they read the requirements using `gatedFollowPerProfile` which points to the chain/token/balance
- user generates `followWithSigData` for a given profile
- user (or relayer) submits this sig along with appropriate input to the `LZGatedProxy` contract on the other chain
- `LZGatedProxy` makes the token check, and relays the message to the `LZGatedFollowModule` on polygon
- `LZGatedFollowModule` contract validates the input, submits sig to `LensHub#followWithSig`
- follow ✅

`LZGatedReferenceModule` is a Lens Reference Module that allows publication creators to gate who can comment/mirror their post with ERC20 or ERC721 balances held on other chains.

`LZGatedCollectModule` is a Lens Collect Module that allows publication creators to gate who can collect their post with ERC20 or ERC721 balances held on other chains.

`LZGatedProxy.sol` acts acts as a proxy for `LZGatedFollowModule`, `LZGatedReferenceModule`, and `LZGatedCollectModule` in order to read token balances from remote contracts on any chain supported by LayerZero.
- we deploy one of these on any EVM chain to be supported by the modules, wire up for trusted LayerZero messaging
- when a user wishes to follow/comment/mirror/collect - they sign the correct data payload and submit along with the correct gate data
- the contract makes the token balance check against the ERC20/ERC721 contract defined
- if all good, relay the payload to our module contract on polygon

## read the [docs](./blog/blog.md)

## setup + compile contracts
```
nvm use
yarn
yarn compile
```

## running tests
To test our Lens module, we use the same setup as seen in `@aave/lens-protocol`. We need to compile their contracts + copy over the generated types
```
cd node_modules/@aave/lens-protocol
npm run compile
cd ../../../
cp -r node_modules/@aave/lens-protocol/typechain-types typechain-types-lens
```

Now we can run our tests
```
yarn quick-test

# if you want to see the gas cost estimates
yarn test

# if you want to see coverage
yarn coverage
```

## deploying contracts (OmniSBT + LZCollectModule)
We deploy our `OmniSBT` contract on the destination chain (`fantom_testnet`) and the source chain (`mumbai`), as well as setting trusted remotes on both ends. Finally, we stub the `FollowCampaignModule` to be the deployer address. All the lz config can be found under `tasks/helpers/constants.ts`

1. deploy `OmniSBT` contract on the destination chain `npx hardhat deploy-token-remote --network fantom_testnet`

2. deploy `OmniSBT` contract on the source chain + set trusted remote `npx hardhat deploy-token-source --network mumbai`

3. set trusted remote on the destination chain `npx hardhat set-trusted-remote --network fantom_testnet`

## deploying contracts (LZGated* modules)
We deploy our Lens modules on the source chain (`mumbai`) and we deploy our `LZGatedProxy` contract to all the remote chains we want to support (`goerli` and `optimismTestnet`). Finally, we set the trusted remotes on each module. All the lz config can be found under `tasks/helpers/constants.ts`
1. deploy our modules on the source chain `npx hardhat deploy-modules-source --network mumbai`
2. deploy our `LZGatedProxy` contract on all remote chains

  a. `npx hardhat deploy-proxy-remote --network goerli`

  b. `npx hardhat deploy-proxy-remote --network optimismTestnet`
3. set our trusted remotes on the source chain `npx hardhat set-trusted-remotes --network mumbai`

## stubbed transactions + tenderly infra (OmniSBT + LZCollectModule)
Considering that our `LZCollectModule` contract is what triggers mints of `OmniSBT` and it relies on lens module whitelisting - we can stub those transaction by setting the collect module to some permissioned address and triggering mints from an off-chain process

1. create a collection and set our lens testnet address as the collect module `npx hardhat stub-create-collection --network mumbai`

2. create a post that we will listen for collects on https://testnet.lenster.xyz/

3. address the `@TODO` in `processCollected.ts` and deploy our tenderly action `cd tenderly && npm run deploy`
  - NOTE: in order for our action to process the `Collect` event off `lens-protocol`, we must add their `InteractionLogic` lib to our tenderly project. You can do so by clicking "Add to project" here: https://dashboard.tenderly.co/contract/mumbai/0xefd400326635e016cbfcc309725d5b62fd9d3468


4. collect our post via lenster or by modifying our task `tasks/stub-collect-post.ts`
