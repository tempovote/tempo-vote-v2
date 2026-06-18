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

validator treasury {
  spend(
    datum: Option<TreasuryDatum>,
    redeemer: ExecuteRedeemer,
    _input: OutputReference,
    tx: Transaction,
  ) {
    expect Some(td) = datum

    list.any(
      tx.reference_inputs,
      fn(ref) {
        when ref.output.datum is {
          InlineDatum(data) -> {
            expect fin: ProposalResult = data
            and {
              fin.alliance_id == td.alliance_id,
              fin.proposal_id == redeemer.proposal_id,
              fin.result == "approved",
              when tx.validity_range.lower_bound.bound_type is {
                Finite(ms) -> ms >= fin.executable_at_ms
                _ -> False
              },
              list.any(
                tx.outputs,
                fn(out) {
                  when out.address.payment_credential is {
                    VerificationKey(pkh) ->
                      pkh == fin.recipient_pkh && lovelace_of(out.value) >= fin.amount
                    _ -> False
                  }
                },
              ),
            }
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
