use aiken/collection/list
use cardano/transaction.{OutputReference, Transaction}
use types.{ScriptHashRegistry}

validator oneshot(utxo_ref: OutputReference) {
  // We include this here so ScriptHashRegistry doesn't get shaken
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

    True
  }

  else(_) {
    fail
  }
}
