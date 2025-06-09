use aiken/collection/list
use aiken/interval.{is_entirely_after}
use aiken/option
use cardano/address.{Credential}
use cardano/assets.{lovelace_of, without_lovelace}
use cardano/transaction.{Transaction}
use sundae/multisig.{satisfied}
use types.{ScriptHashRegistry, TreasuryConfiguration}
use utilities.{outputs_of, value_sum}

// Check whether the funds are swept back to the treasury correctly
// In particular,
pub fn logic(
  config: TreasuryConfiguration,
  account: Credential,
  registry: ScriptHashRegistry,
  transaction: Transaction,
) {
  let Transaction {
    inputs,
    outputs,
    validity_range,
    withdrawals,
    extra_signatories,
    treasury_donation,
    ..
  } = transaction
  let inputs = outputs_of(inputs)
  let input_sum = value_sum(inputs, account, True)
  let output_sum = value_sum(outputs, account, False)

  // Any ADA from the inputs that *isn't* retained in the outputs, must be donated to the treasury
  // We don't check that *all* ADA is donated, in case we need a minUTxO to cover native assets
  // TODO: should we just make the tx builder cover minUTxO instead?
  expect Some(donation) = treasury_donation
  let input_lovelace = lovelace_of(input_sum)
  let output_lovelace = lovelace_of(output_sum)
  expect donation >= input_lovelace - output_lovelace
  // Must donate a sufficient portion of the treasury to prevent single-lovelace UTxO occupation attacks
  // 5 ADA *should* be enough to cover minUTxO if there are native tokens left, and be small enough to not materially impact treasury balances
  // We check against donation - input_lovelace, rather than output_lovelace, *just in case* 5 ADA isn't enough for minUTxO
  // in such cases, the transaction submitter would just need to cover any extra minUTxO requirements
  expect input_lovelace - donation <= 5_000_000

  // Prevent double-satisfaction shenanigans
  expect
    option.is_none(
      inputs
        |> list.find(
            fn(input) { input.address.payment_credential == registry.vendor },
          ),
    )

  // Funds can be swept back to the treasury by anyone after the deadline,
  // or with permissions from the oversight committee early
  trace validity_range
  trace config.expiration
  expect or {
      is_entirely_after(validity_range, config.expiration),
      satisfied(
        config.permissions.sweep,
        extra_signatories,
        validity_range,
        withdrawals,
      ),
    }

  // And any native assets, if present, must be retained at the script address
  expect or {
      assets.is_zero(without_lovelace(input_sum)),
      without_lovelace(input_sum) == without_lovelace(output_sum),
    }
}
