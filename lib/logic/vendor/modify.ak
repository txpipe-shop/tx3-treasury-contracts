use aiken/collection/list
use aiken/interval.{is_entirely_after, is_entirely_before}
use aiken/option
use cardano/address.{Credential}
use cardano/assets
use cardano/transaction.{InlineDatum, Transaction}
use sundae/multisig.{satisfied}
use types.{Active, ScriptHashRegistry, VendorConfiguration, VendorDatum}
use utilities.{greater_than_or_equal_to, outputs_of, payout_sum, value_sum}

// The vendor and the oversight committee can agree to modify or cancel a project
// Specifically, this logic ensures:
//  - Both the vendor and the oversight authorize the transaction
//  - There is a single vendor input, and no treasury inputs
//  - All unmatured funds from the vendor script are split between the treasury and a new vendor script
pub fn logic(
  config: VendorConfiguration,
  account: Credential,
  registry: ScriptHashRegistry,
  transaction: Transaction,
) {
  let VendorConfiguration { permissions, .. } = config
  let Transaction {
    inputs,
    outputs,
    extra_signatories,
    validity_range,
    withdrawals,
    ..
  } = transaction

  // Can only modify before the contract expiration
  expect is_entirely_before(validity_range, config.expiration)

  let inputs = outputs_of(inputs)

  // Make sure we're not spending a treasury input
  expect
    inputs
      |> list.find(
          fn(input) { input.address.payment_credential == registry.treasury },
        )
      |> option.is_none()

  // We choose to only handle modifying one vendor contract at a time,
  // to simplify the contract logic
  expect [input] =
    inputs
      |> list.filter(fn(input) { input.address.payment_credential == account })
  expect InlineDatum(input_vendor_datum) = input.datum
  expect input_vendor_datum: VendorDatum = input_vendor_datum
  //
  // Sum up the matured payouts, which no longer belong to the cardano treasury
  // (the vendor can authorize that these go anywhere)
  let matured_value =
    input_vendor_datum.payouts
      |> list.filter(
          fn(payout) {
            is_entirely_after(validity_range, payout.maturation) && payout.status == Active
          },
        )
      |> list.foldl(
          assets.zero,
          fn(payout, sum) {
            assets.merge(sum, assets.from_asset_list(payout.value))
          },
        )
  // And calculate the funds that are owned by the cardano treasury: anything on the input *other* than the matured funds
  let treasury_owned_funds =
    assets.merge(input.value, assets.negate(matured_value))

  // Sum any funds that stay locked at vendor outputs
  let vendor_outputs =
    outputs
      |> list.filter(
          fn(output) { output.address.payment_credential == account },
        )
  let vendor_output_sum = value_sum(vendor_outputs, account, False)
  // And those that go back to the treasury
  let treasury_output_sum = value_sum(outputs, registry.treasury, False)
  // The sum of these two is the total funds that remain under the control of these scripts (and thus the cardano treasury)
  let retained_funds = assets.merge(vendor_output_sum, treasury_output_sum)

  // Make sure all vendor payouts are well formed by checking the payout sum:
  //  - The new vendor signs the Transaction
  //  - the maturation is before the expiration date
  //  - the output has at least enough funds to cover all outputs (hidden in payout_sum)
  expect _ =
    payout_sum(
      vendor_outputs,
      account,
      fn(v, p) {
        // Ensure the vendor also signs the contract
        // This ensures they consent to the work, but also prevents accidentally
        // locking funds with a nonsensical vendor multisig
        expect
          satisfied(v.vendor, extra_signatories, validity_range, withdrawals)
        // Ensure payouts are bounded, so the oversight committee doesn't create
        // a project that lasts 20 years
        // NOTE: technically config.expiration is different than the constraint enforced when funding
        // meaning the funding could be extended slightly; We deem this acceptable compared to the
        // challenge of getting the payout_upperbound passed into this method
        expect p.maturation <= config.expiration
        True
      },
    )

  expect and {
      // Make sure the value retained by the treasury+vendor contracts is greater than or equal to the value owned by the cardano treasury
      // using greater_than_or_equal_to means we can handle minUTxO, AND the vendor can donate funds back to the treasury if they wish
      // Since the vendor signs the transaction, they're authorizing that fact
      greater_than_or_equal_to(retained_funds, treasury_owned_funds)?,
      // The vendor must authorize the transaction
      satisfied(
        input_vendor_datum.vendor,
        extra_signatories,
        validity_range,
        withdrawals,
      )?,
      // and the modify permission must be satisfied
      satisfied(
        permissions.modify,
        extra_signatories,
        validity_range,
        withdrawals,
      )?,
    }
}
