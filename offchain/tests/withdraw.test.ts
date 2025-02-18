import { beforeEach, describe, expect, test } from 'bun:test';
import { Blaze, Core, Data, HotWallet, makeValue, Provider, TxBuilder, Wallet } from '@blaze-cardano/sdk';
import { HexBlob } from '@blaze-cardano/core';
import { Emulator, EmulatorProvider } from "@blaze-cardano/emulator";
import { withdraw } from '../withdraw';
import { expectScriptFailure, makeExpectTxValid, sampleConfig, setupBlaze } from './utilities.test';
import { loadScript } from '../shared';

describe("When withdrawing", () => {
    const amount = 340_000_000_000_000n
    const { rewardAccount, scriptAddress, treasuryScript } = loadScript(Core.NetworkId.Testnet, sampleConfig())
    
    let emulator: Emulator
    let blaze: Blaze<EmulatorProvider, HotWallet>
    let refInput: Core.TransactionUnspentOutput
    let expectTxValid: (tx: TxBuilder) => Promise<void>
    beforeEach(async () => {
        let setup = await setupBlaze()
        emulator = setup.emulator
        blaze = setup.blaze
        emulator.accounts.set(rewardAccount, amount)
        refInput = (await blaze.provider.resolveScriptRef(treasuryScript))!
        expectTxValid = makeExpectTxValid(blaze, emulator)
    })


    describe("anyone", () => {
        test("can withdraw and lock funds at the script address", async () => {
            expectTxValid(await withdraw(sampleConfig(), amount, blaze))
        })
        test("can split funds across multiple script outputs", async () => {
            expectTxValid(
                blaze.newTransaction()
                    .addWithdrawal(rewardAccount, amount, Data.void())
                    .addReferenceInput(refInput!)
                    .lockLovelace(scriptAddress, amount/2n, Data.void())
                    .lockLovelace(scriptAddress, amount/2n, Data.void())
            )
        })
        test("can attach any datum", async () => {
            expectTxValid(
                blaze.newTransaction()
                    .addWithdrawal(rewardAccount, amount, Data.void())
                    .addReferenceInput(refInput!)
                    .lockLovelace(scriptAddress, amount, Data.from(Core.PlutusData.fromCbor(HexBlob("01"))))
            )
        })
    })
    
    describe("a malicious user", () => {
        test("cannot withdraw funds to some other address", async () => {
            expectScriptFailure(
                blaze.newTransaction()
                    .addWithdrawal(rewardAccount, amount, Data.void())
                    .addReferenceInput(refInput!)
                    .payLovelace(blaze.wallet.address, amount, Data.void())
            )
        })
        test("cannot steal funds by splitting them between destinations", async () => {
            expectScriptFailure(
                blaze.newTransaction()
                    .addWithdrawal(rewardAccount, amount, Data.void())
                    .addReferenceInput(refInput!)
                    .lockLovelace(scriptAddress, amount/2n, Data.void())
                    .payLovelace(blaze.wallet.address, amount/2n, Data.void())
            )
        })
        test("cannot attach a staking address", async () => {
            let fullAddress = new Core.Address({
                type: Core.AddressType.BasePaymentScriptStakeKey,
                networkId: Core.NetworkId.Testnet,
                paymentPart: {
                    type: Core.CredentialType.ScriptHash,
                    hash: treasuryScript.hash(),
                },
                delegationPart: {
                    type: Core.CredentialType.KeyHash,
                    hash: treasuryScript.hash(), // Just use an arbitrary hash
                }
            })
            expectScriptFailure(
                blaze.newTransaction()
                    .addWithdrawal(rewardAccount, amount, Data.void())
                    .addReferenceInput(refInput!)
                    .lockLovelace(fullAddress, amount, Data.from(Core.PlutusData.fromCbor(HexBlob("01"))))
            )
        })
        test("cannot spend from treasury script while withdrawing", async () => {
            const scriptUtxo = new Core.TransactionUnspentOutput(
                new Core.TransactionInput(Core.TransactionId("0".repeat(64)), 0n),
                new Core.TransactionOutput(scriptAddress, makeValue(5_000_000_000n))
            )
            emulator.addUtxo(scriptUtxo)
            expectScriptFailure(
                blaze.newTransaction()
                    .addWithdrawal(rewardAccount, amount, Data.void())
                    .addReferenceInput(refInput!)
                    .addInput(scriptUtxo)
                    .lockLovelace(scriptAddress, amount, Data.void())
            )
        })
    })
})