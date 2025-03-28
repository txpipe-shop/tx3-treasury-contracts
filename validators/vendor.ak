use cardano/transaction.{OutputReference, Transaction, find_input}
use logic/vendor/malformed
use logic/vendor/modify
use logic/vendor/pause
use logic/vendor/resume
use logic/vendor/sweep
use logic/vendor/withdraw
use types.{
  Modify, Pause, Resume, SweepVendor, VendorConfiguration, VendorDatum,
  VendorSpendRedeemer, Withdraw,
}

/// A vendor script, for an ongoing project with an owner
validator vendor(config: VendorConfiguration) {
  spend(
    datum: Option<Data>,
    redeemer: VendorSpendRedeemer,
    utxo: OutputReference,
    self: Transaction,
  ) {
    expect Some(spent_input) = find_input(self.inputs, utxo)
    let account = spent_input.output.address.payment_credential

    when datum is {
      None -> malformed.logic(config, account, self)
      Some(datum) ->
        if datum is VendorDatum {
          when redeemer is {
            Withdraw -> withdraw.logic(self)
            Pause { .. } -> pause.logic(self)
            Resume { .. } -> resume.logic(self)
            Modify -> modify.logic(self)
            SweepVendor -> sweep.logic(self)
          }
        } else {
          malformed.logic(config, account, self)
        }
    }
  }

  // No other actions (withdrawing, minting, publishing certificates, voting, etc.) are valid
  else(_) {
    False
  }
}
