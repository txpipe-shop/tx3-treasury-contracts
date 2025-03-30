use aiken/collection/list
use aiken/interval.{is_entirely_before}
use cardano/address.{Credential}
use cardano/assets.{Value, lovelace_of, merge, negate, without_lovelace}
use cardano/transaction.{InlineDatum, Transaction}
use sundae/multisig.{satisfied}
use types.{TreasuryConfiguration, VendorDatum}
use utilities.{find_script_hash_registry, input_sum, output_sum}

// Pay out funds to the vendor script, to fund a new project
pub fn logic(
  config: TreasuryConfiguration,
  account: Credential,
  amount: Value,
  transaction: Transaction,
) {
  let TreasuryConfiguration {
    registry_token,
    expiration,
    payout_upperbound,
    permissions,
  } = config
  let Transaction {
    inputs,
    reference_inputs,
    outputs,
    validity_range,
    extra_signatories,
    withdrawals,
    ..
  } = transaction

  // Find the script hash registry, so we know the vendor script hash
  let registry = find_script_hash_registry(reference_inputs, registry_token)
  // We need to make sure that the expected amount leaves the control of the treasury script
  // This means summing up the inputs held at the treasury script, then the outputs at both the vendor script
  // and the treasury script.  Since we're iterating over the outputs anyway,
  let input_sum = input_sum(inputs, account)
  let vendor_sum = output_sum(outputs, registry.vendor)
  let output_sum = output_sum(outputs, account)

  // Sum up all of the payouts on all of the vendor outputs
  // checking that the datums are well formed and no payouts are too far in the future
  let payout_sum =
    outputs
      |> list.filter(
          fn(output) { output.address.payment_credential == registry.vendor },
        )
      |> list.foldl(
          assets.zero,
          fn(output, total) {
            // The datum must be well formed
            expect InlineDatum(datum) = output.datum
            expect datum: VendorDatum = datum
            let this_payout_sum =
              datum.payouts
                |> list.foldl(
                    assets.zero,
                    fn(payout, acc) {
                      // Cannot create payouts that are after the upperbound
                      expect payout.maturation <= payout_upperbound
                      assets.merge(acc, assets.from_asset_list(payout.value))
                    },
                  )
            assets.merge(total, this_payout_sum)
          },
        )

  // TODO: do we need to check that the redeemer used for all other inputs at `account` is Fund?
  // TODO: do we need amount? can we just compare the difference between inputs and outputs against the sum of the payouts?
  // might be helpful if we switch to intent-based signing, which would help us avoid cases when the tx gets invalidated
  expect and {
      payout_sum == amount,
      // We allow the lovelace at the vendor contract to be greater, to deal with minUTxO restrictions
      without_lovelace(vendor_sum) == without_lovelace(amount),
      lovelace_of(vendor_sum) >= lovelace_of(amount),
      output_sum == merge(input_sum, negate(amount)),
      is_entirely_before(validity_range, expiration),
      satisfied(
        permissions.fund,
        extra_signatories,
        validity_range,
        withdrawals,
      ),
    }
}
