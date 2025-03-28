use aiken/interval.{is_entirely_before}
use cardano/address.{Credential}
use cardano/assets.{Value, merge, negate}
use cardano/transaction.{Transaction}
use sundae/multisig.{satisfied}
use types.{TreasuryConfiguration}
use utilities.{input_sum, output_sum}

// Disburse an arbitrary amount of funds to an arbitrary destination
pub fn logic(
  config: TreasuryConfiguration,
  account: Credential,
  amount: Value,
  transaction: Transaction,
) {
  let Transaction { inputs, outputs, validity_range, withdrawals, .. } =
    transaction
  let input_sum = input_sum(inputs, account)
  let output_sum = output_sum(outputs, account)
  expect and {
      is_entirely_before(validity_range, config.expiration),
      output_sum == merge(input_sum, negate(amount)),
      satisfied(
        config.permissions.disburse,
        transaction.extra_signatories,
        validity_range,
        withdrawals,
      ),
    }
}
