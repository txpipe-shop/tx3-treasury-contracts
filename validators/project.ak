use cardano/transaction.{OutputReference, Transaction}
use types.{ProjectConfiguration, ProjectDatum, ProjectSpendRedeemer}

/// A vendor script, for an ongoing project with an owner
validator project(_config: ProjectConfiguration) {
  spend(
    _datum: Option<ProjectDatum>,
    _redeemer: ProjectSpendRedeemer,
    _utxo: OutputReference,
    _self: Transaction,
  ) {
    True
  }

  // No other actions (withdrawing, minting, publishing certificates, voting, etc.) are valid
  else(_) {
    False
  }
}
