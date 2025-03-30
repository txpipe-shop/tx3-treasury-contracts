use cardano/transaction.{Transaction}

// If the datum is malformed, such as someone sending funds to the vendor contract directly for some reason
// we don't want those to be locked, so we allow them to be swept back to the treasury contract
pub fn logic(_transaction: Transaction) {
  False
}
