use aiken/collection/list
use cardano/transaction.{OutputReference, Transaction}

validator oneshot(utxo_ref: OutputReference) {
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
