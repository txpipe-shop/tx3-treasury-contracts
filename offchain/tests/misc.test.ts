import { beforeEach, describe, test } from 'bun:test';
import { Blaze, Core, Data, HotWallet, TxBuilder } from '@blaze-cardano/sdk';
import { Credential } from '@blaze-cardano/core';
import { Emulator, EmulatorProvider } from "@blaze-cardano/emulator";
import { expectScriptFailure, makeExpectTxInvalid, makeExpectTxValid, sampleConfig, setupBlaze } from './utilities.test';
import { loadScript } from '../shared';

// NOTE: these test are disabled for now, while we wait for blaze to add support for them
describe("miscellaneous", () => {
    const amount = 340_000_000_000_000n
    const { rewardAccount, credential, treasuryScript } = loadScript(Core.NetworkId.Testnet, sampleConfig())
    
    let emulator: Emulator
    let blaze: Blaze<EmulatorProvider, HotWallet>
    let refInput: Core.TransactionUnspentOutput
    let expectTxValid: (tx: TxBuilder) => Promise<void>
    let expectTxInvalid: (tx: TxBuilder) => Promise<void>
    beforeEach(async () => {
        let setup = await setupBlaze()
        emulator = setup.emulator
        blaze = setup.blaze
        emulator.accounts.set(rewardAccount, amount)
        refInput = (await blaze.provider.resolveScriptRef(treasuryScript))!
        expectTxValid = makeExpectTxValid(blaze, emulator)
        expectTxInvalid = makeExpectTxInvalid(blaze, emulator)
    })

    test.skip("Cannot deregister stake address", async () => {
        expectScriptFailure(
            blaze.newTransaction()
                .addReferenceInput(refInput!)
        )
    })

    test.skip("Cannot delegate stake address", async () => {
        expectScriptFailure(
            blaze.newTransaction()
                .addReferenceInput(refInput!)
                .addDelegation(Credential.fromCore(credential), Core.PoolId("pool1x9q4jf3zwftwygeeulku8xtlywmtmzwxjk2g3fz3j5mlwjqnr3p"), Data.void())
        )
    })
})