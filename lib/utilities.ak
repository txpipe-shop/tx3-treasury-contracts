use aiken/collection/list
use aiken/interval.{Finite, Interval}
use aiken/option
use cardano/address.{Credential, Inline, Script, VerificationKey}
use cardano/assets.{PolicyId, Value, lovelace_of, without_lovelace}
use cardano/transaction.{InlineDatum, Input, Output}
use types.{Payout, ScriptHashRegistry, VendorDatum, registry_token_name}

pub fn find_script_hash_registry(
  reference_inputs: List<Input>,
  registry_token: PolicyId,
) -> ScriptHashRegistry {
  expect Some(input) =
    reference_inputs
      |> list.find(
          fn(input) {
            assets.quantity_of(
              input.output.value,
              registry_token,
              registry_token_name(),
            ) > 0
          },
        )
  expect InlineDatum(datum) = input.output.datum
  expect registry: ScriptHashRegistry = datum
  registry
}

pub fn ensure_compliant_scripts(
  inputs: List<Input>,
  registry: ScriptHashRegistry,
) {
  expect
    inputs
      |> list.all(
          fn(input) {
            when input.output.address.payment_credential is {
              VerificationKey(_) -> True
              Script(_) -> or {
                  input.output.address.payment_credential == registry.treasury,
                  input.output.address.payment_credential == registry.vendor,
                }
            }
          },
        )
}

pub fn ensure_no_ref_scripts(outputs: List<Output>) {
  expect
    outputs
      |> list.all(fn(output) { option.is_none(output.reference_script) })
}

// Get the output of each input
pub fn outputs_of(inputs: List<Input>) -> List<Output> {
  list.map(inputs, fn(input) { input.output })
}

pub fn equal_plus_min_ada(expected: Value, actual: Value) -> Bool {
  and {
    without_lovelace(expected) == without_lovelace(actual),
    lovelace_of(expected) <= lovelace_of(actual),
  }
}

// Sum up all assets on the `outputs` held at `account`
// Note: can also be used to traverse the inputs by mapping over them first
pub fn value_sum(
  outputs: List<Output>,
  account: Credential,
  allow_different_stake: Bool,
) -> Value {
  outputs
    |> list.filter(fn(output) { output.address.payment_credential == account })
    |> list.map(
        fn(output) {
          expect or {
              allow_different_stake,
              output.address.stake_credential == Some(Inline(account)),
            }
          output.value
        },
      )
    |> list.reduce(assets.zero, assets.merge)
}

pub fn payout_sum(
  outputs: List<Output>,
  vendor: Credential,
  filter: fn(VendorDatum, Payout) -> Bool,
) -> Value {
  outputs
    |> list.filter(fn(output) { output.address.payment_credential == vendor })
    |> list.foldl(
        assets.zero,
        fn(output, total) {
          // The datum must be well formed
          expect InlineDatum(datum) = output.datum
          expect datum: VendorDatum = datum
          let (this_payout_sum, payout_count) =
            datum.payouts
              |> list.foldl(
                  (assets.zero, 0),
                  fn(payout, acc) {
                    let value = assets.from_asset_list(payout.value)
                    // Benchmarking shows that if we allow more than 4 tokens in the value, we can exceed execution units
                    // on the sweep / withdraw operations quickly, leaving funds locked forever; this leaves room for
                    // ADA + USDM + USDA + one other and if we really need more, we can split them over multiple payouts
                    expect 4 >= ( value |> assets.flatten |> list.length )
                    if filter(datum, payout) {
                      (assets.merge(acc.1st, value), acc.2nd + 1)
                    } else {
                      (acc.1st, acc.2nd + 1)
                    }
                  },
                )
          // Benchmarking shows that if we allow more than 35 payouts, we can exceed execution units
          // on the sweep / withdraw operations quickly, leaving funds locked forever; this leaves room for
          // payouts twice per month, which should be plenty, and if we really need more we can do two separate funded projects
          expect payout_count <= 24
          // Ensure that the output has enough funds to cover the payout
          expect equal_plus_min_ada(this_payout_sum, output.value)
          assets.merge(total, this_payout_sum)
        },
      )
}

pub const thirty_six_hours: Int = 36 * 60 * 60 * 1000

pub fn interval_length_at_most(interval: Interval<Int>, length: Int) -> Bool {
  when (interval.upper_bound.bound_type, interval.lower_bound.bound_type) is {
    (Finite(b), Finite(a)) -> b - a <= length
    _ -> False
  }
}
