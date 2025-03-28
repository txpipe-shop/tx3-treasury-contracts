use aiken/interval.{is_entirely_before}
use cardano/address.{Credential}
use cardano/assets.{Value, merge, negate, lovelace_of}
use cardano/transaction.{Transaction}
use sundae/multisig.{satisfied}
use types.{TreasuryConfiguration}
use utilities.{input_sum, output_sum}

// To support conversion to and from stablecoins, or fiat payments,
// the oversight committee can disburse an arbitrary amount of funds
// to an arbitrary address with an arbitrary datum.
// If it's past the expiration, only native assets can be disbursed.
// If required, we could impose additional restrictions on this, such as
// an allow-list of addresses, etc.
pub fn logic(
  config: TreasuryConfiguration,
  account: Credential,
  amount: Value,
  transaction: Transaction,
) {
  let TreasuryConfiguration { expiration, permissions, .. } = config
  let Transaction { inputs, outputs, validity_range, withdrawals, .. } =
    transaction
  let input_sum = input_sum(inputs, account)
  let output_sum = output_sum(outputs, account)
  expect and {
      is_entirely_before(validity_range, expiration),
      output_sum == merge(input_sum, negate(amount)),
      // If we're before the expiration, we can pay out lovelace this way
      // After the expiration, we can *only* send native assets out, presumably to be converted back to ADA
      // This is to prevent USDM, for example, getting permanently locked
      or {
        lovelace_of(amount) == 0,
        is_entirely_before(validity_range, expiration),
      },
      satisfied(
        permissions.disburse,
        transaction.extra_signatories,
        validity_range,
        withdrawals,
      ),
    }
}
