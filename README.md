# lz-collect-module

`LZCollectModule` is a Lens Collect Module that allows creators to mint soulbound NFTs (OmniSBT) for their followers that are cross-chain compatible, via LayerZero.
- a creator attaches this module to one of their posts and specifies parameters such as the destination chain id
- any user that collects the post gets an OmniSBT minted on the destination chain

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


## TODO:
- unit tests
- deploy tasks for all LZ supported testnets: https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
- tenderly infra as interim for below (specific mumbai lens post + destination set as Optimism)
- await Lens module whitelist process
- documentation / blog post
- open source!
