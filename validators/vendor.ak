use cardano/transaction.{OutputReference, Transaction, find_input}
use logic/vendor/malformed
use logic/vendor/modify
use logic/vendor/adjudicate
use logic/vendor/sweep
use logic/vendor/withdraw
use types.{
  Modify, Adjudicate, SweepVendor, VendorConfiguration,
  VendorSpendRedeemer, Withdraw, Malformed,
}

/// A vendor script, for an ongoing project with an owner
validator vendor(config: VendorConfiguration) {
  spend(
    _: Option<Data>,
    redeemer: VendorSpendRedeemer,
    utxo: OutputReference,
    self: Transaction,
  ) {
    expect Some(spent_input) = find_input(self.inputs, utxo)
    let account = spent_input.output.address.payment_credential

    when redeemer is {
      Withdraw -> withdraw.logic(account, self)
      Adjudicate { .. } -> adjudicate.logic(self)
      Modify -> modify.logic(self)
      SweepVendor -> sweep.logic(config, account, self)
      Malformed -> malformed.logic(config, account, self)
    }
  }

  // No other actions (withdrawing, minting, publishing certificates, voting, etc.) are valid
  else(_) {
    False
  }
}
