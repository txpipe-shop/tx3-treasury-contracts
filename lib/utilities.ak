use aiken/collection/list
use aiken/interval.{Finite, Interval}
use aiken/option
use cardano/address.{Credential, Inline, Script, VerificationKey}
use cardano/assets.{PolicyId, Value, lovelace_of, without_lovelace}
use cardano/transaction.{InlineDatum, Input, Output}
use types.{Payout, ScriptHashRegistry, VendorDatum, registry_token_name}

// Find, among a list of reference inputs, the script hash registry
// This is a one-shot NFT locked with a datum that describes the treasury and vendor script hash
// This can be used to resolve circular dependencies: the treasury script needs to know the vendor
// script hash; and the vendor script needs to know the treasury script hash
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

// To prevent double satisfaction, we disallow any inputs from *other* scripts
// ONLY the treasury and vendor scripts are allowed on the inputs
pub fn ensure_compliant_scripts(
  inputs: List<Input>,
  registry: ScriptHashRegistry,
) {
  expect
    inputs
      |> list.all(
          fn(input) {
            when input.output.address.payment_credential is {
              // However, someone needs to pay fees, so verification key credentials are allowed
              VerificationKey(_) -> True
              Script(_) -> or {
                  input.output.address.payment_credential == registry.treasury,
                  input.output.address.payment_credential == registry.vendor,
                }
            }
          },
        )
}

// Because reference scripts have an exponential (if small) effect on the fee,
// we disallow reference scripts on the outputs, to prevent someone from being annoying
pub fn ensure_no_ref_scripts(outputs: List<Output>) {
  expect
    outputs
      |> list.all(fn(output) { option.is_none(output.reference_script) })
}

// Each `Input` is a pair of a reference, and the output it's referring to
// so this utility extracts the output side of each input
pub fn outputs_of(inputs: List<Input>) -> List<Output> {
  list.map(inputs, fn(input) { input.output })
}

// Check that the assets are identical, but the lovelace of `actual` is *at least* as much as `expected`
// For example, if comparing inputs to outputs, this allows the ADA to increase if it needs to to cover minUTxO
// but doesn't allow it to decrease, and doesn't allow arbitrary other tokens to be added
pub fn equal_plus_min_ada(expected: Value, actual: Value) -> Bool {
  and {
    without_lovelace(expected) == without_lovelace(actual),
    lovelace_of(expected) <= lovelace_of(actual),
  }
}

// Checks that, for each token in `right`, `left` has at least that much
pub fn greater_than_or_equal_to(left: Value, right: Value) -> Bool {
  right
    |> assets.flatten
    |> list.all(
        fn((policy, name, qty)) {
          assets.quantity_of(left, policy, name) >= qty
        },
      )
}

// Sum up all assets on the `outputs` held at `account`
// Note that combined with "outputs_of", this can also be used to traverse the inputs
// Note: can also be used to traverse the inputs by mapping over them first
// Also contains a parameter to decide whether we should enforce the stake address on the "output"
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

// Sum up the payouts on any outputs locked at the vendor address
// Also ensures that:
//  - Each vendor output has a valid Datum
//  - Each payout has a well-formed Value
//  - Each vendor output is bounded in size (at most 24 payouts, at most 4 assets in the payout value)
//  - The actual value on each vendor output is sufficient to cover all of its payouts
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
                    // Note that from_asset_list enforces invariants about the value stored in the InlineDatum
                    // such as no duplicates etc.
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

// Check that an interval is *at most* a specific length, in milliseconds
// In particular, can be used to make sure the transaction isn't playing games with the
// lower bound of the transaction
pub fn interval_length_at_most(interval: Interval<Int>, length: Int) -> Bool {
  when (interval.upper_bound.bound_type, interval.lower_bound.bound_type) is {
    (Finite(b), Finite(a)) -> b - a <= length
    _ -> False
  }
}
