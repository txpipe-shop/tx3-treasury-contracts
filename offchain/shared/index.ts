import { Core } from "@blaze-cardano/sdk"
import { TreasuryTreasuryWithdraw } from "../types/contracts"

export interface Configuration {
    expiration:bigint,
}

export function loadScript(
    network: Core.NetworkId,
    config: Configuration,
) {
    const treasuryScript = new TreasuryTreasuryWithdraw(config)
    const credential = { 
        type: Core.CredentialType.ScriptHash,
        hash: treasuryScript.hash(),
    }
    const rewardAccount = Core.RewardAccount.fromCredential(credential, network)
    const scriptAddress = new Core.Address({
        type: Core.AddressType.EnterpriseScript,
        networkId: network,
        paymentPart: credential,
      })
    return {
        treasuryScript,
        credential,
        rewardAccount,
        scriptAddress,
    }
}
