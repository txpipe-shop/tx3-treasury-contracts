// use sundae/aicone.{MultisigScript}

pub type Configuration {
  // The permissions required to sweep everything back to the treasury early
  // TODO: this should be a MultisigScript, but blaze doesn't like recursive types
  // sweep_permissions: Data, // MultisigScript,
  // The time after which the funds can be swept back to the treasury
  expiration: Int,
}

pub type SpendRedeemer {
  Sweep
  Reserved
}
