use aiken/collection/list
use aiken/interval.{is_entirely_before}
use cardano/address.{Credential}
use cardano/assets.{Value, merge, negate}
use cardano/transaction.{InlineDatum, Transaction}
use sundae/multisig.{satisfied}
use types.{TreasuryConfiguration, VendorDatum}
use utilities.{input_sum, output_sum}

// Pay out funds to the vendor script, to fund a new project
pub fn logic(
  config: TreasuryConfiguration,
  account: Credential,
  amount: Value,
  transaction: Transaction,
) {
  let TreasuryConfiguration {
    expiration,
    vendor_script,
    payout_upperbound,
    permissions,
  } = config
  let Transaction {
    inputs,
    outputs,
    validity_range,
    extra_signatories,
    withdrawals,
    ..
  } = transaction
  // We need to make sure that the expected amount leaves the control of the treasury script
  // This means summing up the inputs held at the treasury script, then the outputs at both the vendor script
  // and the treasury script.  Since we're iterating over the outputs anyway,
  let input_sum = input_sum(inputs, account)
  let vendor_sum = output_sum(outputs, vendor_script)
  let output_sum = output_sum(outputs, account)

  // Sum up all of the payouts on all of the vendor outputs
  // checking that the datums are well formed and no payouts are too far in the future
  let payout_sum =
    outputs
      |> list.filter(
          fn(output) { output.address.payment_credential == vendor_script },
        )
      |> list.foldl(
          assets.zero,
          fn(output, total) {
            expect InlineDatum(datum) = output.datum
            expect datum: VendorDatum = datum
            // Cannot create payouts that are after the upperbound
            let this_payout_sum =
              datum.payouts
                |> list.foldl(
                    assets.zero,
                    fn(payout, acc) {
                      expect payout.maturation <= payout_upperbound
                      assets.merge(acc, assets.from_asset_list(payout.value))
                    },
                  )
            assets.merge(total, this_payout_sum)
          },
        )

  // TODO: do we need to check that the redeemer used for all other inputs at `account` is Fund?
  //
  expect and {
      payout_sum == amount,
      vendor_sum == amount,
      output_sum == merge(input_sum, negate(vendor_sum)),
      is_entirely_before(validity_range, expiration),
      satisfied(
        permissions.fund,
        extra_signatories,
        validity_range,
        withdrawals,
      ),
    }
}
