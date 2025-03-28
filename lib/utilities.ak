use aiken/collection/list
use cardano/address.{Credential}
use cardano/assets.{PolicyId, Value}
use cardano/transaction.{Input, Output, InlineDatum}
use types.{ScriptHashRegistry, registry_token_name}

pub fn find_script_hash_registry(reference_inputs: List<Input>, registry_token: PolicyId) -> ScriptHashRegistry {
  expect Some(input) = reference_inputs
    |> list.find(fn(input) { assets.quantity_of(input.output.value, registry_token, registry_token_name()) > 0 })
  expect InlineDatum(datum) = input.output.datum
  expect registry: ScriptHashRegistry = datum
  registry
}

// Sum up all assets on the `inputs` held at `account`
pub fn input_sum(inputs: List<Input>, account: Credential) -> Value {
  inputs
    |> list.filter(
        fn(input) { input.output.address.payment_credential == account },
      )
    |> list.map(fn(input) { input.output.value })
    |> list.reduce(assets.zero, assets.merge)
}

// Sum up all assets on the `outputs` held at `account` and ensure there is no staking address attached
pub fn output_sum(outputs: List<Output>, account: Credential) -> Value {
  outputs
    |> list.filter(fn(output) { output.address.payment_credential == account })
    |> list.map(
        fn(output) {
          // Treasury funds must not be staked
          expect None = output.address.stake_credential
          output.value
        },
      )
    |> list.reduce(assets.zero, assets.merge)
}
