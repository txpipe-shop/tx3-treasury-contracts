use aiken/collection/list
use aiken/interval.{is_entirely_after}
use cardano/address.{Credential, Inline}
use cardano/transaction.{InlineDatum, Transaction}
use sundae/multisig.{satisfied}
use types.{
  Active, Paused, PayoutStatus, ScriptHashRegistry, VendorConfiguration,
  VendorDatum,
}
use utilities.{
  equal_plus_min_ada, interval_length_at_most, outputs_of, thirty_six_hours,
}

// The oversight committee can pause a specific payouts during a dispute
// Specifically, this logic enforces that:
//  - There is a single vendor input
//  - There is a single vendor output with an equal value (allowing for ADA to increase for minUTxO)
//  - The list of payouts is the same length
//  - For each paired input and output payout
//    - The maturity date and amount are unchanged
//    - If the input payout is active and matures in the past, the status is unchanged
//  - If at least one payout flips from active to inactive, the `pause` permission is satisfied
//  - If at least one payout flips from Inactive to Active, the `resume` permission is satisfied
//  - At least one payout changes
pub fn logic(
  statuses: List<PayoutStatus>,
  config: VendorConfiguration,
  account: Credential,
  registry: ScriptHashRegistry,
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

  let inputs = outputs_of(inputs)

  // Ensure there are no treasury inputs, to prevent double-satisfaction shenanigans
  expect None =
    inputs
      |> list.find(
          fn(input) { input.address.payment_credential == registry.treasury },
        )

  // Find (and enforce) a singular vendor input
  expect [vendor_input] =
    inputs
      |> list.filter(fn(input) { input.address.payment_credential == account })

  expect InlineDatum(input_vendor_datum) = vendor_input.datum
  expect input_vendor_datum: VendorDatum = input_vendor_datum

  // Find (and enforce) a single vendor output
  expect [vendor_output] =
    outputs
      |> list.filter(
          fn(output) { output.address.payment_credential == account },
        )
  // Ensure the stake address on the output is the correct one, to prevent staking rewards / etc.
  expect vendor_output.address.stake_credential == Some(Inline(account))

  expect InlineDatum(output_vendor_datum) = vendor_output.datum
  expect output_vendor_datum: VendorDatum = output_vendor_datum

  // Adjudicate can't change the number of outputs
  expect
    list.length(input_vendor_datum.payouts) == list.length(
      output_vendor_datum.payouts,
    )

  // And the oversight committee must provide a new status for every payout
  expect list.length(input_vendor_datum.payouts) == list.length(statuses)

  // Check which permissions we need
  // The two zips here are safe because we just asserted that the lengths are equal
  let (pause_permission_needed, resume_permission_needed) =
    input_vendor_datum.payouts
      |> list.zip(output_vendor_datum.payouts)
      |> list.zip(statuses)
      |> list.foldl(
          (False, False),
          fn(((ip, op), status), (pause, resume)) {
            // Make sure we don't change anything else about the payout
            expect status == op.status
            expect ip.maturation == op.maturation
            expect ip.value == op.value
            // And that we're not changing an active, matured payout
            expect
              if is_entirely_after(validity_range, ip.maturation) && ip.status == Active {
                op.status == Active
              } else {
                True
              }
            // (n.b. && and || are right-associative)
            (
              pause || ip.status == Active && op.status == Paused,
              resume || ip.status == Paused && op.status == Active,
            )
          },
        )

  expect and {
      // The interval length must be limited, otherwise our is_entirely_after checks above could be bypassed
      interval_length_at_most(validity_range, thirty_six_hours)?,
      // It should be impossible to remove funds
      equal_plus_min_ada(vendor_input.value, vendor_output.value)?,
      // We can't adjudicate *just* to adjudicate, we have to actually be making a change
      or {
        pause_permission_needed?,
        resume_permission_needed?,
      }?,
      // And, check the relevant permissions if needed
      or {
        !pause_permission_needed?,
        satisfied(
          config.permissions.pause,
          extra_signatories,
          validity_range,
          withdrawals,
        )?,
      }?,
      or {
        !resume_permission_needed?,
        satisfied(
          config.permissions.resume,
          extra_signatories,
          validity_range,
          withdrawals,
        )?,
      }?,
    }
}
