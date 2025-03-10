use aiken/interval.{is_entirely_before}
use cardano/address.{Credential}
use cardano/transaction.{Transaction}
use sundae/multisig.{satisfied}
use types.{TreasuryConfiguration}
use utilities.{input_sum, output_sum}

// Reorganize the treasury UTxOs
pub fn logic(
  config: TreasuryConfiguration,
  account: Credential,
  transaction: Transaction,
) {
  let Transaction {
    inputs,
    outputs,
    validity_range,
    extra_signatories,
    withdrawals,
    ..
  } = transaction
  let input_sum = input_sum(inputs, account)
  let output_sum = output_sum(outputs, account)

  // TODO: do we need to check that the redeemer used for all other inputs at `account` is reogranize?
  expect and {
      input_sum == output_sum,
      is_entirely_before(validity_range, config.expiration),
      satisfied(
        config.permissions.reorganize,
        extra_signatories,
        validity_range,
        withdrawals,
      ),
    }
}
