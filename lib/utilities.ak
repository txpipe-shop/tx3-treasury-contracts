use aiken/collection/list
use cardano/address.{Credential}
use cardano/assets
use cardano/transaction.{Input, Output}

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
