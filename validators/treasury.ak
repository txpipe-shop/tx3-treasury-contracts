use aiken/collection/list
use aiken/collection/pairs
use cardano/address.{Credential}
use cardano/assets.{lovelace_of}
use cardano/transaction.{Transaction}

validator treasury {
  spend(_d, _r, _i, _t) {
    // TODO
    False
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
    let output_sum =
      self.outputs
        |> list.filter(fn(output) { output.address.payment_credential == account })
        |> list.map(
            fn(output) {
              // Treasury funds must not be staked
              expect None = output.address.stake_credential
              lovelace_of(output.value)
            },
          )
        |> list.reduce(0, +)

    // Ensure that the output sum is *at least* the amount
    // This allows some flexibility in case of minUTxO issues, which are unlikely
    // NOTE: We do *not* let the fee be deducted here, because that would allow someone to set the fee very large!
    expect output_sum >= amount

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
