use aiken/interval.{Interval, is_entirely_after}
use cardano/address.{Credential}
use cardano/assets.{Lovelace, lovelace_of, without_lovelace}
use cardano/transaction.{Input, Output}
use utilities.{input_sum, output_sum}

pub fn logic(
  validity_range: Interval<Int>,
  expiration: Int,
  inputs: List<Input>,
  outputs: List<Output>,
  account: Credential,
  treasury_donation: Option<Lovelace>,
) {
  // First, check the authorization
  expect is_entirely_after(validity_range, expiration)
  // satisfied(sweep, extra_signatories, validity_range, withdrawals),
  let input_sum = input_sum(inputs, account)
  let output_sum = output_sum(outputs, account)

  // Any ADA from the inputs that *isn't* retained in the outputs, must be donated to the treasury
  expect Some(donation) = treasury_donation
  expect donation >= lovelace_of(input_sum) - lovelace_of(output_sum)

  // And any native assets must be retained at the script address
  expect or {
      assets.is_zero(without_lovelace(input_sum)),
      without_lovelace(input_sum) == without_lovelace(output_sum),
    }
}
