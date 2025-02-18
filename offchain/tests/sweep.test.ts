import { beforeEach, describe, test } from 'bun:test';
import { Blaze, Core, Data, HotWallet, makeValue, TxBuilder } from '@blaze-cardano/sdk';
import { Emulator, EmulatorProvider } from "@blaze-cardano/emulator";
import { expectScriptFailure, makeExpectTxInvalid, makeExpectTxValid, sampleConfig, setupBlaze } from './utilities.test';
import { loadScript } from '../shared';
import { sweep } from '../sweep';
import { TreasuryTreasurySpend } from '../types/contracts';
import { Slot } from '@blaze-cardano/core';

describe("When sweeping", () => {
    const amount = 340_000_000_000_000n
    const { rewardAccount, scriptAddress, treasuryScript } = loadScript(Core.NetworkId.Testnet, sampleConfig())
    
    let emulator: Emulator
    let blaze: Blaze<EmulatorProvider, HotWallet>
    let scriptInput: Core.TransactionUnspentOutput
    let secondScriptInput: Core.TransactionUnspentOutput
    let withAssetScriptInput: Core.TransactionUnspentOutput
    let refInput: Core.TransactionUnspentOutput
    let expectTxValid: (tx: TxBuilder) => Promise<void>
    let expectTxInvalid: (tx: TxBuilder) => Promise<void>
    beforeEach(async () => {
        let setup = await setupBlaze()
        emulator = setup.emulator
        blaze = setup.blaze
        emulator.accounts.set(rewardAccount, amount)
        expectTxValid = makeExpectTxValid(blaze, emulator)
        expectTxInvalid = makeExpectTxInvalid(blaze, emulator)
        
        scriptInput = new Core.TransactionUnspentOutput(
            new Core.TransactionInput(Core.TransactionId("1".repeat(64)), 0n),
            new Core.TransactionOutput(scriptAddress, makeValue(500_000_000_000n))
        )
        scriptInput.output().setDatum(Core.Datum.newInlineData(Core.PlutusData.fromCbor(Core.HexBlob("00"))));
        emulator.addUtxo(scriptInput)
        secondScriptInput = new Core.TransactionUnspentOutput(
            new Core.TransactionInput(Core.TransactionId("1".repeat(64)), 1n),
            new Core.TransactionOutput(scriptAddress, makeValue(1_000_000_000n))
        )
        secondScriptInput.output().setDatum(Core.Datum.newInlineData(Core.PlutusData.fromCbor(Core.HexBlob("00"))));
        emulator.addUtxo(secondScriptInput)
        withAssetScriptInput = new Core.TransactionUnspentOutput(
            new Core.TransactionInput(Core.TransactionId("1".repeat(64)), 2n),
            new Core.TransactionOutput(scriptAddress, makeValue(1_000_000_000n, ["a".repeat(64), 1n]))
        )
        withAssetScriptInput.output().setDatum(Core.Datum.newInlineData(Core.PlutusData.fromCbor(Core.HexBlob("00"))));
        emulator.addUtxo(withAssetScriptInput)
        refInput = (await blaze.provider.resolveScriptRef(treasuryScript))!
    })

    describe("after the timeout", () => {
        beforeEach(() => {
            for(let i = 0; i < 1000 / 20; i++) {
                emulator.stepForwardBlock();
            }
        }) 

        describe("anyone", () => {
            test("can sweep funds back to the treasury", async () => {  
                expectTxValid(await sweep(sampleConfig(), scriptInput, blaze))
            })

            test("can partially sweep, so long as the remainder stays locked", async () => {
                expectTxValid(await sweep(sampleConfig(), scriptInput, blaze, 5_000_000n))
            })

            test("can donate additional funds", async () => {
                expectTxValid(
                    blaze.newTransaction()
                        .addInput(scriptInput, Data.to("Sweep", TreasuryTreasurySpend.redeemer))
                        .setValidFrom(Slot(Number(sampleConfig().expiration)))
                        .addReferenceInput(refInput)
                        .setDonation(scriptInput.output().amount().coin() + 1_000_000n)
                )
            })

            test("can sweep multiple inputs at once", async () => {
                expectTxValid(
                    blaze.newTransaction()
                        .addInput(scriptInput, Data.to("Sweep", TreasuryTreasurySpend.redeemer))
                        .addInput(secondScriptInput, Data.to("Sweep", TreasuryTreasurySpend.redeemer))
                        .setValidFrom(Slot(Number(sampleConfig().expiration)))
                        .addReferenceInput(refInput)
                        .setDonation(scriptInput.output().amount().coin() + secondScriptInput.output().amount().coin())
                )
            })

            test("can sweep so long as native assets stay locked", async () => {
                expectTxValid(
                    blaze.newTransaction()
                        .addInput(withAssetScriptInput, Data.to("Sweep", TreasuryTreasurySpend.redeemer))
                        .lockAssets(scriptAddress, makeValue(2_000_000n, ["a".repeat(64), 1n]), Data.void())
                        .setValidFrom(Slot(Number(sampleConfig().expiration)))
                        .addReferenceInput(refInput)
                        .setDonation(withAssetScriptInput.output().amount().coin())
                )
            })

            test("must donate all funds not re-locked at the script address", async () => {
                expectScriptFailure(
                    blaze.newTransaction()
                        .addInput(scriptInput, Data.to("Sweep", TreasuryTreasurySpend.redeemer))
                        .setValidFrom(Slot(Number(sampleConfig().expiration)))
                        .addReferenceInput(refInput)
                        .setDonation(scriptInput.output().amount().coin() / 2n)
                )
            })
        })

        describe("a malicious user", () => {
            test("cannot steal from second input", async () => {
                expectScriptFailure(
                    blaze.newTransaction()
                        .addInput(scriptInput, Data.to("Sweep", TreasuryTreasurySpend.redeemer))
                        .addInput(secondScriptInput, Data.to("Sweep", TreasuryTreasurySpend.redeemer))
                        .setValidFrom(Slot(Number(sampleConfig().expiration)))
                        .addReferenceInput(refInput)
                        .setDonation(scriptInput.output().amount().coin() + secondScriptInput.output().amount().coin() - 1n)
                )
            })

            test("cannot steal native assets", async () => {
                expectScriptFailure(
                    blaze.newTransaction()
                        .addInput(withAssetScriptInput, Data.to("Sweep", TreasuryTreasurySpend.redeemer))
                        .setValidFrom(Slot(Number(sampleConfig().expiration)))
                        .addReferenceInput(refInput)
                        .setDonation(withAssetScriptInput.output().amount().coin())
                )
            })

            test("cannot attach their own staking address", async () => {
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
                        .addInput(withAssetScriptInput, Data.to("Sweep", TreasuryTreasurySpend.redeemer))
                        .lockAssets(fullAddress, makeValue(2_000_000n, ["a".repeat(64), 1n]), Data.void())
                        .setValidFrom(Slot(Number(sampleConfig().expiration)))
                        .addReferenceInput(refInput)
                        .setDonation(withAssetScriptInput.output().amount().coin())
                )
            })
        })
    })

    describe("before the timeout", () => {
        beforeEach(() => {
            for(let i = 0; i < (1000 / 20) - 1; i++) {
                emulator.stepForwardBlock();
            }
        })

        describe("a malicious user", () => {
            test("cannot sweep funds", async () => {
                expectTxInvalid(await sweep(sampleConfig(), scriptInput, blaze))
            })
        })
    })
})