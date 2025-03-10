use aiken/collection/list
use cardano/address.{Credential}
use cardano/assets
use cardano/transaction.{Input, Output}

// Sum up all assets on the `inputs` held at `account`
pub fn input_sum(inputs: List<Input>, account: Credential) -> assets.Value {
  inputs
    |> list.filter(
        fn(input) { input.output.address.payment_credential == account },
      )
    |> list.map(
        fn(input) {
          // Treasury funds must not be staked
          input.output.value
        },
      )
    |> list.reduce(assets.zero, assets.merge)
}

// Sum up all assets on the `outputs` held at `account` and ensure there is no staking address attached
pub fn output_sum(outputs: List<Output>, account: Credential) -> assets.Value {
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
