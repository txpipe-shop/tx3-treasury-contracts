import { Data, TxBuilder, type Blaze, type Provider, type Wallet } from "@blaze-cardano/sdk"
import { loadScript, type Configuration } from "../shared"

export async function withdraw<P extends Provider, W extends Wallet>(
    config: Configuration,
    amount: bigint,
    blaze: Blaze<P, W>,
): Promise<TxBuilder> {
    const { rewardAccount, scriptAddress, treasuryScript } = loadScript(blaze.provider.network, config)
    const refInput = await blaze.provider.resolveScriptRef(treasuryScript)
    if (!refInput) throw new Error("Could not find treasury script reference on-chain")
    return blaze.newTransaction()
        .addWithdrawal(rewardAccount, amount, Data.void())
        .addReferenceInput(refInput)
        .lockLovelace(scriptAddress, amount, Data.void())
}