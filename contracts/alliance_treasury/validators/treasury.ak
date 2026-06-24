use aiken/collection/list
use aiken/interval.{Finite}
use cardano/address.{VerificationKey}
use cardano/assets.{lovelace_of}
use cardano/transaction.{InlineDatum, OutputReference, Transaction}

pub type TreasuryDatum {
  alliance_id: ByteArray,
}

pub type ProposalResult {
  alliance_id: ByteArray,
  proposal_id: ByteArray,
  result: ByteArray,
  amount: Int,
  recipient_pkh: ByteArray,
  executable_at_ms: Int,
}

pub type ExecuteRedeemer {
  proposal_id: ByteArray,
}

// Minimum ADA required for a UTxO output (protocol minimum ~1 ADA).
// If remaining treasury balance after withdrawal is below this, the treasury
// simply becomes empty rather than requiring a dust change output.
const min_utxo_lovelace: Int = 1_500_000

validator treasury {
  spend(
    datum: Option<TreasuryDatum>,
    redeemer: ExecuteRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(td) = datum

    // Find the treasury UTxO being spent to get its value and address.
    expect Some(own_input) =
      list.find(tx.inputs, fn(i) { i.output_reference == own_ref })
    let spent_lovelace = lovelace_of(own_input.output.value)
    let treasury_address = own_input.output.address

    // Ensure only ONE treasury UTxO is spent per withdrawal to prevent
    // multi-input draining attacks.
    let treasury_input_count =
      list.count(tx.inputs, fn(i) { i.output.address == treasury_address })
    expect treasury_input_count == 1

    // Find a valid ProposalResult reference input for this withdrawal.
    list.any(
      tx.reference_inputs,
      fn(ref) {
        when ref.output.datum is {
          InlineDatum(data) -> {
            expect fin: ProposalResult = data
            let withdrawal_ok =
              and {
                fin.alliance_id == td.alliance_id,
                fin.proposal_id == redeemer.proposal_id,
                fin.result == "approved",
                when tx.validity_range.lower_bound.bound_type is {
                  Finite(ms) -> ms >= fin.executable_at_ms
                  _ -> False
                },
                // Recipient must receive exactly the approved amount (not more, not less).
                list.any(
                  tx.outputs,
                  fn(out) {
                    when out.address.payment_credential is {
                      VerificationKey(pkh) ->
                        pkh == fin.recipient_pkh && lovelace_of(out.value) == fin.amount
                      _ -> False
                    }
                  },
                ),
              }

            // Treasury change (spent - withdrawn) must return to the same treasury
            // address with the same alliance datum. This prevents any party from
            // draining the treasury beyond the approved withdrawal amount.
            let change_lovelace = spent_lovelace - fin.amount
            let change_ok =
              if change_lovelace < min_utxo_lovelace {
                // Remaining balance is below min UTxO — treasury is effectively
                // emptied, no change output required.
                True
              } else {
                list.any(
                  tx.outputs,
                  fn(out) {
                    when out.datum is {
                      InlineDatum(out_data) -> {
                        expect out_td: TreasuryDatum = out_data
                        and {
                          out.address == treasury_address,
                          lovelace_of(out.value) == change_lovelace,
                          out_td.alliance_id == td.alliance_id,
                        }
                      }
                      _ -> False
                    }
                  },
                )
              }

            withdrawal_ok && change_ok
          }
          _ -> False
        }
      },
    )
  }

  else(_) {
    False
  }
}
