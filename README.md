# treasury-funds

These contracts provide a simple but robust way to manage funds withdrawn from the treasury.

They ensure that the funds cannot be delegated, and cannot be used in governance voting. They also ensure ADA held at the contracts eventually returns to the Cardano treasury, and allows certain actions subject to the approval of a configurable set of permissions.

There are two contracts:

- validators/treasury.ak holds funds withdrawn from the Cardano treasury
- validators/vendor.ak holds funds intended for a specific vendor, for a specific project, subject to a periodic vesting

These two contracts permit 13 separate actions.

Anyone can perform these actions:

- Withdraw funds from the reward account to the script
- Delegating the treasury and vendor script addresses to the always abstain drep, as required by Article IV, Section 5 of the constitution.
- Unregistering the stake credential and reclaiming the 2ADA deposit after the "expiration" date (see below)
- Sweeping funds at the treasury script back to the cardano treasury after the "expiration" date (see below)
- Sweep funds locked with a malformed datum from the vendor script to the treasury script
  - For example, if someone sends funds without a datum directly to the vendor script for some reason
- Sweeping funds locked at the vendor script back to the treasury script after the "expiration"

And each of these have their own configurable permissions:

- Reorganize funds held at the treasury contract, such as splitting and merging UTxOs
- Sweeping funds held at the treasury contract back to the cardano treasury _early_
- Funding a project for a vendor with a set of delivery milestones
- Disbursing funds to an arbitrary address and datum
- Pausing a specific milestone for a vendor, preventing it from being claimed in case of a dispute of delivered work
- Resuming a paused milestone, after the dispute has been resolved
- Modifying a project, with a vendors permission, to restructure the milestones or pay funds back to the treasury script

Each separate permission can be any combination of atLeast, any, all, before, after, signature, and script conditions, just like (with the exception of script conditions) Cardano Native Scripts.

The script conditions allow you to attach arbitrary additional logic, in the form of a withdrawal script that must be present on the transaction.

The intention for these permissions is for them to match the operational risk to those administering the funds and to ensure the will of the DReps is captured when messy changes that the script logic can't account for arise.

The contracts are parameterized by:

- A registry token
  - A one-shot NFT that holds a datum with the relevant script addresses
  - This allows each contract to know the script hash of the other without introducing a circular compilation dependency
- A treasury expiration
  - After this timestamp (in milliseconds since Midnight, January 1st, 1970), all ADA held at the treasury contracts can be swept back to the cardano treasury.
- A vendor maximum payout date
  - To ensure continuity of service for some contracts, the end date of the contract may need to extend past the end date of the treasury expiration
  - However, we don't want to allow the oversight committee to set up a 20 year monthly contract
  - Thus, no project can be funded past the vendor maximum payout date
- And permissions, in the form of an aicone/multisig script for each of the 7 actions:
  - Reorganize
  - Sweep Early
  - Disburse
  - Fund
  - Pause
  - Resume
  - Modify

This repository publishes a typescript SDK for interacting with the smart contracts [to NPM](https://www.npmjs.com/package/@sundaeswap/treasury-funds), and a CLI tool for easily building common transaction types.

We includes a battery of tests in `offchain/tests`, which use the blaze emulator to test many positive and negative test cases, as well as a dedicated test case for each finding discovered during the audit process.

The contracts were audited by two independent, well respected Cardano audit firms, TxPipe and MLabs, and those reports can be found in `audits/`.

These contracts were tested heavily in [preview](https://preview.cexplorer.io/tx/58241ae6e6844ca75a5306d4036db72ebf0a4665c66f1045aae48541b81d3bde), [Sanchonet](https://sancho.cardanoconnect.io/govern/gov_action_proposal/35), and [mainnet](https://cardanoscan.io/address/addr1x88kv96gv4684srqdr4zfwvhnz3jvtjn7628nt70efjvcl70vct5set50tqxq682yjue0x9rych98a550xhuljnye3lsjdxkrp).

Finally, paired with a [metadata standard](./offchain/src/metadata/spec.md), Sundae Labs and Xerberus are ensuring that each transaction is fully justified, transparent, and easily indexible on-chain by interested parties and tool builders.
