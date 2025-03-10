use aiken/interval.{is_entirely_before}
use cardano/address.{Credential}
use cardano/assets.{Value, merge, negate}
use cardano/transaction.{Transaction}
use sundae/multisig.{satisfied}
use types.{TreasuryConfiguration}
use utilities.{input_sum, output_sum}

// Pay out funds to the vendor script, to fund a new project
pub fn logic(
  config: TreasuryConfiguration,
  account: Credential,
  amount: Value,
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
  let vendor_sum = output_sum(outputs, config.vendor_script)
  let input_sum = input_sum(inputs, account)
  let output_sum = output_sum(outputs, account)

  // TODO: do we need to check that the redeemer used for all other inputs at `account` is Fund?
  expect and {
      vendor_sum == amount,
      output_sum == merge(input_sum, negate(vendor_sum)),
      is_entirely_before(validity_range, config.expiration),
      satisfied(
        config.permissions.fund,
        extra_signatories,
        validity_range,
        withdrawals,
      ),
    }
}
