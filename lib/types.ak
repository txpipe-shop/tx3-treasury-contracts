use cardano/address.{Credential}
use cardano/assets.{AssetName, PolicyId}
use sundae/multisig.{MultisigScript}

/// We store the script hashes at a specific datum at an always fails script
/// so we can "tie the knot" and resolve circular references
pub type ScriptHashRegistry {
  treasury: Credential,
  vendor: Credential,
}

pub fn registry_token_name() -> AssetName {
  "REGISTRY"
}

/// The different permission thresholds for the treasury
pub type TreasuryPermissions {
  // The permissions required to reorganize the UTxOs in the wallet
  reorganize: MultisigScript,
  // The condition under which the funds can be swept back early
  sweep: MultisigScript,
  // The condition under which the funds can be paid out to the vendor contract
  // This may, for example, be a lower threshold than disbursement
  fund: MultisigScript,
  // The condition under which the funds can be paid out to an arbitrary destination
  // This may, for example, be stricter than paying to the vendor contract
  disburse: MultisigScript,
}

/// Treasury script configuration
pub type TreasuryConfiguration {
  // The token used to authenticate the script hash registry
  registry_token: PolicyId,
  // The permissions required for different options
  permissions: TreasuryPermissions,
  // The time after which the funds can be swept back to the treasury
  expiration: Int,
  // The upper bound for any payouts created by the oversight committee
  payout_upperbound: Int,
}

pub type VendorPermissions {
  // The permissions required to pause the vendor script
  pause: MultisigScript,
  // The permissions required to resume the vendor script
  resume: MultisigScript,
  // The permissions required for the oversight committee to approve a modification
  // NOTE: the vendor must also approve the modification
  modify: MultisigScript,
}

pub type VendorConfiguration {
  // The token used to authenticate the script hash registry
  registry_token: PolicyId,
  // The permissions required for different actions
  permissions: VendorPermissions,
  // The time after which unmatured funds can be swept back to the treasury
  expiration: Int,
}

pub type TreasurySpendRedeemer {
  // Reorganize funds controlled by the script
  Reorganize
  // Sweep funds back to the treasury
  SweepTreasury
  // Pay out funds to the vendor script to fund a new project
  Fund { amount: Pairs<PolicyId, Pairs<AssetName, Int>> }
  // Pay out funds to an arbitrary destination
  Disburse { amount: Pairs<PolicyId, Pairs<AssetName, Int>> }
}

pub type VendorSpendRedeemer {
  // A vendor can withdraw matured payments; also used as a no-op for the vendor to attach tx metadata for, ex., providing evidence
  Withdraw
  // Update the paused/active statuses of each payout
  Adjudicate { statuses: List<PayoutStatus> }
  // Reclaim the funds at the vendor script, relocking some or all of them at a new vendor contract, and return the rest to the treasury contract
  Modify
  // Sweep any remaining funds back to the treasury contract after the vendor expiration
  SweepVendor
  // Sweep any malformed UTxO back to the treasury contract
  Malformed
}

pub type PayoutStatus {
  // This specific payout is not contested, and will be claimable by the vendor as of the maturation date
  Active
  // This specific payout is contested by the oversight committee
  Paused
}

pub type Payout {
  // The POSIX timestamp, in milliseconds since Jan 1 1970, at which these funds mature and belong to the Vendor
  maturation: Int,
  // The value to be paid out at this specific date
  value: Pairs<PolicyId, Pairs<AssetName, Int>>,
  // The current status of this payout
  status: PayoutStatus,
}

pub type VendorDatum {
  // Who is allowed to withdraw matured payouts?
  vendor: MultisigScript,
  // What are all the relevant payouts?
  payouts: List<Payout>,
}
