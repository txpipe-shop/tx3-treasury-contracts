use aiken/collection/list
use cardano/assets
use cardano/transaction.{OutputReference, Transaction}
use types.{ScriptHashRegistry}

// A one-shot NFT for the script hash registry
// Allows minting a single NFT with a unique policy ID
// Also disallows spending, so we can use this script address to hold the registry
validator oneshot(utxo_ref: OutputReference) {
  // We include this here so ScriptHashRegistry doesn't get spent
  spend(
    _d: Option<ScriptHashRegistry>,
    _r: Data,
    _o: OutputReference,
    _s: Transaction,
  ) {
    False
  }

  mint(_r: Void, _policy_id: ByteArray, self: Transaction) {
    let Transaction { inputs, .. } = self

    expect Some(_) =
      list.find(inputs, fn(input) { input.output_reference == utxo_ref })

    expect [(_, _, qty)] = self.mint |> assets.flatten
    expect qty == 1

    True
  }

  else(_) {
    fail
  }
}
