import { Data, makeValue, TxBuilder, type Blaze, type Provider, type Wallet } from "@blaze-cardano/sdk"
import { Slot, TransactionUnspentOutput } from "@blaze-cardano/core"
import { loadScript, type Configuration } from "../shared"
import { TreasuryTreasurySpend } from "../types/contracts"

// TODO: blaze donation support
export async function sweep<P extends Provider, W extends Wallet>(
    config: Configuration,
    input: TransactionUnspentOutput,
    blaze: Blaze<P, W>,
    amount?: bigint,
): Promise<TxBuilder> {
    const { scriptAddress, treasuryScript } = loadScript(blaze.provider.network, config)
    const refInput = await blaze.provider.resolveScriptRef(treasuryScript)
    if (!refInput) throw new Error("Could not find treasury script reference on-chain")
    let tx = blaze.newTransaction()
        .addInput(input, Data.to("Sweep", TreasuryTreasurySpend.redeemer))
        .setValidFrom(Slot(Number(config.expiration)))
        .addReferenceInput(refInput)
        .setDonation(amount ?? input.output().amount().coin())
    if (!!amount) {
        tx = tx.lockAssets(scriptAddress, makeValue(input.output().amount().coin() - amount), Data.void())
    }
    return tx
}