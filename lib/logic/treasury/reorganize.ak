use aiken/interval.{is_entirely_before}
use cardano/address.{Credential}
use cardano/assets.{lovelace_of, without_lovelace}
use cardano/transaction.{Transaction}
use sundae/multisig.{satisfied}
use types.{TreasuryConfiguration}
use utilities.{input_sum, output_sum}

// Before the expiration, the oversight committee can reorganize the treasury UTxOs, so long as no value escapes
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

  // The funds coming in should exactly match the funds going out
  let input_sum = input_sum(inputs, account)
  let output_sum = output_sum(outputs, account)

  // TODO: do we need to check that the redeemer used for all other inputs at `account` is reogranize?
  expect and {
      // All native assets must remain at the contract unchanged
      without_lovelace(input_sum) == without_lovelace(output_sum),
      // We allow the oversight committee to *increase* the amount of ADA,
      // to cover minUTxO requirements
      lovelace_of(input_sum) <= lovelace_of(output_sum),
      is_entirely_before(validity_range, config.expiration),
      satisfied(
        config.permissions.reorganize,
        extra_signatories,
        validity_range,
        withdrawals,
      ),
    }
}
