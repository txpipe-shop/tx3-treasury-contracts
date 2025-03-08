use aiken/interval.{is_entirely_before}
use cardano/address.{Credential}
use cardano/assets.{Value, merge, negate}
use cardano/transaction.{Transaction}
use sundae/multisig.{satisfied}
use types.{Configuration}
use utilities.{input_sum, output_sum}

pub fn logic(
  config: Configuration,
  account: Credential,
  amount: Value,
  transaction: Transaction,
) -> Bool {
  let input_sum = input_sum(transaction.inputs, account)
  let output_sum = output_sum(transaction.outputs, account)
  and {
    is_entirely_before(transaction.validity_range, config.expiration),
    output_sum == merge(input_sum, negate(amount)),
    todo,
  }
  // satisfied(
  //   config.oversight_council,
  //   transaction.extra_signatories,
  //   transaction.validity_range,
  //   transaction.withdrawals,
  // ),
}
