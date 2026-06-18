use cardano/transaction.{OutputReference, Transaction}

// UTxOs at this address are permanent Finalization records (reference inputs only).
// Always fails — nobody can spend from here.
validator proposal_registry {
  spend(
    _datum: Option<Data>,
    _redeemer: Data,
    _input: OutputReference,
    _tx: Transaction,
  ) {
    False
  }

  else(_) {
    False
  }
}
