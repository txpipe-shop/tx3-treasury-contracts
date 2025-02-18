use aiken/collection/list
use aiken/collection/pairs
use aiken/interval.{is_entirely_after}
use cardano/address.{Credential}
use cardano/assets.{lovelace_of, without_lovelace}
use cardano/transaction.{OutputReference, Transaction, find_input}
use types.{Configuration, SpendRedeemer, Sweep}
use utilities.{input_sum, output_sum}

validator treasury(config: Configuration) {
  spend(_d, redeemer: SpendRedeemer, utxo: OutputReference, self: Transaction) {
    let Configuration { expiration } = config
    // TODO: blaze recursive type support
    // expect sweep: MultisigScript = sweep_permissions
    let Transaction { validity_range, .. } = self

    expect Some(spent_input) = find_input(self.inputs, utxo)
    let account = spent_input.output.address.payment_credential

    when redeemer is {
      // Funds can be swept back to the treasury if signed by a threshold of the auditing parties, or after an expiration
      Sweep -> {
        // First, check the authorization
        expect is_entirely_after(validity_range, expiration)
        // satisfied(sweep, extra_signatories, validity_range, withdrawals),
        let input_sum = input_sum(self.inputs, account)
        let output_sum = output_sum(self.outputs, account)

        // Any ADA from the inputs that *isn't* retained in the outputs, must be donated to the treasury
        expect Some(donation) = self.treasury_donation
        expect donation >= lovelace_of(input_sum) - lovelace_of(output_sum)

        // And any native assets must be retained at the script address
        expect or {
            assets.is_zero(without_lovelace(input_sum)),
            without_lovelace(input_sum) == without_lovelace(output_sum),
          }
      }
      _ -> fail
    }

    True
  }

  // Funds can be withdrawn only if they are paid to the spending portion of this script
  // without a staking address; this is how the funds are moved out of the reward account
  // after a treasury withdrawal
  withdraw(_, account: Credential, self: Transaction) {
    // There must be only one withdrawal from this credential
    expect [amount] = self.withdrawals |> pairs.get_all(account)

    // To prevent shenanigans where a disbursement equal to the amount is used to trick
    // the withdrawal, we assert that `account` never occurs in the inputs
    // This is slightly less flexible than ensuring the totals carry through, but
    // also simpler to reason about
    expect None =
      self.inputs
        |> list.find(
            fn(input) { input.output.address.payment_credential == account },
          )

    // Sum up the amounts of the withdrawal paid to `account`
    // This lets us split the funds across multiple UTxOs for accounting purposes
    // but still ensures that the total amount is correct
    let output_sum = output_sum(self.outputs, account)

    // Ensure that the output sum is *at least* the amount
    // This allows some flexibility in case of minUTxO issues, which are unlikely
    // NOTE: We do *not* let the fee be deducted here, because that would allow someone to set the fee very large!
    expect lovelace_of(output_sum) >= amount

    // If all the above is true, allow the withdrawal
    True
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
