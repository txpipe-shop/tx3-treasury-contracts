use sundae/multisig.{MultisigScript}

pub type Configuration {
  // The permissions required to sweep everything back to the treasury early
  sweep_permissions: MultisigScript,
  // The time after which the funds can be swept back to the treasury
  expiration: Int,
}

pub type SpendRedeemer {
  Sweep
  Reserved
}
