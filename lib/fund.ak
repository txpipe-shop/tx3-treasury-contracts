use aiken/collection/list
use aiken/interval.{is_entirely_before}
use cardano/address.{Credential}
use cardano/assets.{Value, merge, negate}
use cardano/transaction.{InlineDatum, Transaction}
use sundae/multisig.{satisfied}
use types.{ProjectDatum, TreasuryConfiguration}
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
  // We need to make sure that the expected amount leaves the control of the treasury script
  // This means summing up the inputs held at the treasury script, then the outputs at both the vendor script
  // and the treasury script.  Since we're iterating over the outputs anyway, 
  let input_sum = input_sum(inputs, account)
  let vendor_sum = output_sum(outputs, config.vendor_script)
  let output_sum = output_sum(outputs, account)

  // Make sure the datums for each vendor output are well formed
  expect
    outputs
      |> list.filter(
          fn(output) {
            output.address.payment_credential == config.vendor_script
          },
        )
      |> list.all(
          fn(output) {
            expect InlineDatum(datum) = output.datum
            expect _: ProjectDatum = datum
            True
          },
        )

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
