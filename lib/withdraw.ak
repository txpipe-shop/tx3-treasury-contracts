use aiken/collection/list
use aiken/collection/pairs
use cardano/address.{Credential}
use cardano/assets.{Lovelace, lovelace_of}
use cardano/transaction.{Input, Output}
use utilities.{output_sum}

pub fn logic(
  withdrawals: Pairs<Credential, Lovelace>,
  account: Credential,
  inputs: List<Input>,
  outputs: List<Output>,
) -> Bool {
  // There must be only one withdrawal from this credential
  expect [amount] = withdrawals |> pairs.get_all(account)

  // To prevent shenanigans where a disbursement equal to the amount is used to trick
  // the withdrawal, we assert that `account` never occurs in the inputs
  // This is slightly less flexible than ensuring the totals carry through, but
  // also simpler to reason about
  expect None =
    inputs
      |> list.find(
          fn(input) { input.output.address.payment_credential == account },
        )

  // Sum up the amounts of the withdrawal paid to `account`
  // This lets us split the funds across multiple UTxOs for accounting purposes
  // but still ensures that the total amount is correct
  let output_sum = output_sum(outputs, account)
  // Ensure that the output sum is *at least* the amount
  // This allows some flexibility in case of minUTxO issues, which are unlikely
  // NOTE: We do *not* let the fee be deducted here, because that would allow someone to set the fee very large!
  lovelace_of(output_sum) >= amount
}
