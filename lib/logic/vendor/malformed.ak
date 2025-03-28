use cardano/transaction.{Transaction}
use types.{VendorConfiguration}
use cardano/address.{Credential}
use utilities.{find_script_hash_registry, input_sum, output_sum}
use cardano/assets.{lovelace_of, without_lovelace}

// If the datum is malformed, such as someone sending funds to the vendor contract directly for some reason
// we don't want those to be locked, so we allow them to be swept back to the treasury contract
pub fn logic(config: VendorConfiguration, account: Credential, transaction: Transaction) {
  let VendorConfiguration {
    registry_token,
    ..
  } = config
  let Transaction {
    inputs,
    reference_inputs,
    outputs,
    ..
  } = transaction

  // Find the script hash registry, so we know the treasury script hash
  let registry = find_script_hash_registry(reference_inputs, registry_token)

  // Note: we don't need to assert the datums of the outputs,
  // because the treasury contract doesn't use a datum at all!
  let input_sum = input_sum(inputs, account)
  let output_sum = output_sum(outputs, registry.treasury)

  and {
    without_lovelace(input_sum) == without_lovelace(output_sum),
    // Allow the ADA to increase, to deal with minUTxO nonsense
    lovelace_of(input_sum) <= lovelace_of(output_sum)
  }
}
