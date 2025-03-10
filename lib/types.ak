use cardano/address.{Credential}
use cardano/assets.{AssetName, PolicyId}
use sundae/multisig.{MultisigScript}

/// The different permission thresholds for the treasury
pub type Permissions {
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
  // The permissions required for different options
  permissions: Permissions,
  // The time after which the funds can be swept back to the treasury
  expiration: Int,
  // The payment credential of the vendor script for new projects
  vendor_script: Credential,
}

pub type TreasurySpendRedeemer {
  // Reorganize funds controlled by the script
  Reorganize
  // Sweep funds back to the treasury
  Sweep
  // Pay out funds to the vendor script to fund a new project
  Fund { amount: Pairs<PolicyId, Pairs<AssetName, Int>> }
  // Pay out funds to an arbitrary destination
  Disburse { amount: Pairs<PolicyId, Pairs<AssetName, Int>> }
}
