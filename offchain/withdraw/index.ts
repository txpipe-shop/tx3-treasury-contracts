import { Data, TxBuilder, type Blaze, type Provider, type Wallet } from "@blaze-cardano/sdk"
import { loadScript } from "../shared"

export async function withdraw<P extends Provider, W extends Wallet>(
    amount: bigint,
    blaze: Blaze<P, W>,
): Promise<TxBuilder> {
    const { rewardAccount, scriptAddress, treasuryScript } = loadScript(blaze.provider.network)
    const refInput = await blaze.provider.resolveScriptRef(treasuryScript)
    if (!refInput) throw new Error("Could not find treasury script reference on-chain")
    return blaze.newTransaction()
        .addWithdrawal(rewardAccount, amount, Data.void())
        .addReferenceInput(refInput)
        .lockLovelace(scriptAddress, amount, Data.void())
}