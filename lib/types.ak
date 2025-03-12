use cardano/address.{Credential}
use cardano/assets.{AssetName, PolicyId}
use sundae/multisig.{MultisigScript}

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
  // The permissions required for different options
  permissions: TreasuryPermissions,
  // The time after which the funds can be swept back to the treasury
  expiration: Int,
  // The payment credential of the vendor script for new projects
  vendor_script: Credential,
}

pub type ProjectPermissions {
  // The permissions required to pause the vendor script
  pause: MultisigScript,
  // The permissions required to resume the vendor script
  resume: MultisigScript,
  // The permissions required for the oversight committee to approve a modification
  // NOTE: the vendor must also approve the modification 
  modify: MultisigScript,
}

pub type ProjectConfiguration {
  // The permissions required for different actions
  permissions: ProjectPermissions,
  // The time after which the funds can be swept back to the treasury
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

pub type ProjectSpendRedeemer {
  Withdraw
  Pause
  Resume
  Modify
  SweepVendor
}

pub type Payout =
  (Int, Pairs<PolicyId, Pairs<AssetName, Int>>)

pub type ProjectStatus {
  Active
  Paused
}

pub type ProjectDatum {
  vendor: MultisigScript,
  matured: Int,
  payouts: List<Payout>,
  status: ProjectStatus,
}
