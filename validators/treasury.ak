use cardano/address.{Credential}
use cardano/transaction.{OutputReference, Transaction, find_input}
use sweep
use types.{Configuration, SpendRedeemer, Sweep}
use withdraw

validator treasury(config: Configuration) {
  spend(_d, redeemer: SpendRedeemer, utxo: OutputReference, self: Transaction) {
    let Configuration { expiration } = config

    expect Some(spent_input) = find_input(self.inputs, utxo)
    let account = spent_input.output.address.payment_credential

    when redeemer is {
      // Funds can be swept back to the treasury after the expiration
      Sweep -> sweep.logic(expiration, account, self)
      _ -> fail
    }

    True
  }

  // Funds can be withdrawn only if they are paid to the spending portion of this script
  // without a staking address; this is how the funds are moved out of the reward account
  // after a treasury withdrawal
  withdraw(_, account: Credential, self: Transaction) {
    withdraw.logic(self.withdrawals, account, self.inputs, self.outputs)
  }

  // (n.b. We could just use `else` for these, but it's clearer to make things explicit)

  // The funds received by the treasury are not allowed to vote in governance
  vote(_r, _v, _t) {
    False
  }

  // The funds received by the treasury are not allowed to publish any certificates
  // In particular, this prevents the stake script from delegating to a stake pool,
  // registering a stake pool, registering as a DRep, or delegating to a DRep.
  publish(_r, _c, _t) {
    False
  }

  else(_) {
    False
  }
}
