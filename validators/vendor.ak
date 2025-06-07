use aiken/interval.{is_entirely_after}
use cardano/certificate.{
  AlwaysAbstain, Certificate, DelegateCredential, DelegateVote,
  RegisterAndDelegateCredential, RegisterCredential, UnregisterCredential,
}
use cardano/transaction.{OutputReference, Transaction, find_input}
use logic/vendor/adjudicate
use logic/vendor/malformed
use logic/vendor/modify
use logic/vendor/sweep
use logic/vendor/withdraw
use types.{
  Adjudicate, Malformed, Modify, SweepVendor, VendorConfiguration, VendorDatum,
  VendorSpendRedeemer, Withdraw,
}
use utilities.{
  ensure_compliant_scripts, ensure_no_ref_scripts, find_script_hash_registry,
}

/// A vendor script, for an ongoing project with an owner
validator vendor(config: VendorConfiguration) {
  spend(
    // We don't restrict the datum yet here, because we allow malformed UTxOs to be swept to the treasury
    _: Option<Data>,
    redeemer: VendorSpendRedeemer,
    utxo: OutputReference,
    self: Transaction,
  ) {
    // Find our own input
    expect Some(spent_input) = find_input(self.inputs, utxo)
    let account = spent_input.output.address.payment_credential

    // Find the script registry (which lets us know the treasury script address)
    let registry =
      find_script_hash_registry(self.reference_inputs, config.registry_token)

    // Make sure *only* the treasury and vendor scripts exist on the input, to avoid double satisfaction shenanigans
    ensure_compliant_scripts(self.inputs, registry)
    // And make sure we don't attach any reference scripts on the outputs, to avoid inflating fees
    ensure_no_ref_scripts(self.outputs)

    when redeemer is {
      Withdraw -> withdraw.logic(account, self)
      Adjudicate { statuses } ->
        adjudicate.logic(statuses, config, account, registry, self)
      Modify -> modify.logic(config, account, registry, self)
      SweepVendor -> sweep.logic(config, account, registry, self)
      Malformed -> malformed.logic(account, registry, self)
    }

    True
  }

  // The funds received by the treasury must not be used to register or delegate to a stake pool,
  // or be used to participate in governance; in particular, must be delegated to the always abstain DRep
  // to ensure large treasury withdrawals don't deadlock governance
  publish(_redeemer: Data, certificate: Certificate, self: Transaction) {
    // Article IV - Section 5 of the constitution requires that funds:
    //
    // - SHALL NOT be delegated to an SPO
    // - MUST be delegated to an auto-abstain DRep
    //
    when certificate is {
      UnregisterCredential { .. } ->
        is_entirely_after(self.validity_range, config.expiration)
      RegisterCredential { .. } -> True
      DelegateCredential { delegate, .. } |
      RegisterAndDelegateCredential { delegate, .. } ->
        delegate == DelegateVote(AlwaysAbstain)
      _ -> False
    }
  }

  // No other actions (withdrawing, minting, voting, etc.) are valid
  else(_) {
    False
  }
}

// The generated plutus.json file won't include the vendor datum, because it isn't used in
// the public API of the validator above; So, we define a small "documentation" validator
// to ensure that it shows up for the codegen tools
validator documentation {
  spend(_d: Option<VendorDatum>, _r: Data, _o: OutputReference, _s: Transaction) {
    False
  }

  else(_) {
    fail
  }
}
