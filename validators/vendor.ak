use cardano/transaction.{OutputReference, Transaction}
use types.{VendorConfiguration, VendorDatum, VendorSpendRedeemer}

/// A vendor script, for an ongoing project with an owner
validator vendor(_config: VendorConfiguration) {
  spend(
    _datum: Option<VendorDatum>,
    _redeemer: VendorSpendRedeemer,
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
