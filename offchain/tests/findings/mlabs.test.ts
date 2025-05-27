import { beforeEach, describe, test } from "bun:test";
import { Core, makeValue, Value } from "@blaze-cardano/sdk";
import * as Data from "@blaze-cardano/data";
import { Emulator } from "@blaze-cardano/emulator";
import {
  deployScripts,
  findRegistryInput,
  fund_key,
  Funder,
  sampleTreasuryConfig,
  sampleVendorConfig,
  scriptOutput,
  setupEmulator,
  vendor_key,
  modify_key,
  Modifier,
  pause_key,
  Pauser,
} from "../utilities";
import {
  coreValueToContractsValue,
  loadScripts,
  slot_to_unix,
  unix_to_slot,
} from "../../src/shared";
import {
  MultisigScript,
  TreasurySpendRedeemer,
  VendorDatum,
  VendorSpendRedeemer,
} from "../../src/types/contracts";
import { fund } from "src/treasury";
import { modify } from "src/vendor";
import { Ed25519KeyHashHex } from "@cardano-sdk/crypto";

describe("MLabs Audit Findings", () => {
  let emulator: Emulator;
  beforeEach(async () => {
    emulator = await setupEmulator(undefined, false);
  });

  describe("3.4", () => {
    test("cannot steal funds meant to be swept through double satisfaction", async () => {
      const treasuryConfig1 = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator, 1),
        await sampleVendorConfig(emulator, 1),
      );
      const treasuryConfig2 = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator, 2),
        await sampleVendorConfig(emulator, 2),
      );
      const treasury1Input = scriptOutput(
        emulator,
        treasuryConfig1.treasuryScript,
        makeValue(500_000_000_000n),
        Data.Void(),
      );

      const treasury2Input = scriptOutput(
        emulator,
        treasuryConfig2.treasuryScript,
        makeValue(500_000_000_000n),
        Data.Void(),
      );

      await deployScripts(emulator, treasuryConfig1);
      await deployScripts(emulator, treasuryConfig2);
      const treasury1RefInput = emulator.lookupScript(
        treasuryConfig1.treasuryScript.script.Script,
      );
      const treasury2RefInput = emulator.lookupScript(
        treasuryConfig2.treasuryScript.script.Script,
      );
      const registryInput1 = findRegistryInput(emulator, 1);
      const registryInput2 = findRegistryInput(emulator, 2);

      emulator.stepForwardToUnix(
        treasuryConfig1.treasuryScript.config.expiration + 1n,
      );

      await emulator.as("MaliciousUser", async (blaze) => {
        await emulator.expectScriptFailure(
          blaze
            .newTransaction()
            // Sweep
            .addReferenceInput(treasury1RefInput)
            .addReferenceInput(treasury2RefInput)
            .addReferenceInput(registryInput1)
            .addReferenceInput(registryInput2)
            .addInput(
              treasury1Input,
              Data.serialize(TreasurySpendRedeemer, "SweepTreasury"),
            )
            .addInput(
              treasury2Input,
              Data.serialize(TreasurySpendRedeemer, "SweepTreasury"),
            )
            .setValidFrom(
              unix_to_slot(
                treasuryConfig1.treasuryScript.config.expiration + 1000n,
              ),
            )
            .setDonation(500_000_000_000n),
          /trace expect\s*inputs\s*|> list.all\(\s*fn\(input\) {\s*when input.output.address.payment_credential is {/,
        );
      });
    });
  });

  describe("3.5", () => {
    test("cannot steal funds meant to be swept through double satisfaction", async () => {
      const treasuryConfig = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      const treasuryInput = scriptOutput(
        emulator,
        treasuryConfig.treasuryScript,
        makeValue(500_000_000_000n),
        Data.Void(),
      );

      await deployScripts(emulator, treasuryConfig);
      const treasuryRefInput = emulator.lookupScript(
        treasuryConfig.treasuryScript.script.Script,
      );
      const vendorRefInput = emulator.lookupScript(
        treasuryConfig.vendorScript.script.Script,
      );
      const registryInput = findRegistryInput(emulator);
      const vendorInput = scriptOutput(
        emulator,
        treasuryConfig.vendorScript,
        makeValue(500_000_000_000n),
        Data.Void(),
      );
      emulator.stepForwardToUnix(
        treasuryConfig.treasuryScript.config.expiration + 1n,
      );
      await emulator.as("MaliciousUser", async (blaze) => {
        await emulator.expectScriptFailure(
          blaze
            .newTransaction()
            // Sweep
            .addInput(
              treasuryInput,
              Data.serialize(TreasurySpendRedeemer, "SweepTreasury"),
            )
            .setValidFrom(
              unix_to_slot(
                treasuryConfig.treasuryScript.config.expiration + 1000n,
              ),
            )
            .addReferenceInput(treasuryRefInput)
            .setDonation(500_000_000_000n)
            // Malformed
            .addReferenceInput(registryInput)
            .addReferenceInput(vendorRefInput)
            .addInput(
              vendorInput,
              Data.serialize(VendorSpendRedeemer, "Malformed"),
            )
            .lockAssets(
              treasuryConfig.treasuryScript.scriptAddress,
              vendorInput.output().amount(),
              Data.Void(),
            ),
          /expect\s*option.is_none\(\s*inputs\s*|> list.find\(\s*fn(input) { input.address.payment_credential == registry.treasury }/,
        );
      });
    });
  });

  describe("3.6", () => {
    test("cannot steal from the treasury reward account through double satisfaction", async () => {
      const config = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, config);

      const withdrawAmount = 340_000_000_000n;
      emulator.accounts.set(
        config.treasuryScript.rewardAccount!,
        withdrawAmount,
      );

      const vendorInput = scriptOutput(
        emulator,
        config.vendorScript,
        makeValue(500_000_000_000n),
        Data.Void(),
      );

      const treasuryRefInput = emulator.lookupScript(
        config.treasuryScript.script.Script,
      );
      const vendorRefInput = emulator.lookupScript(
        config.vendorScript.script.Script,
      );
      const registryInput = findRegistryInput(emulator);
      await emulator.as("MaliciousUser", async (blaze, addr) => {
        await emulator.expectScriptFailure(
          blaze
            .newTransaction()
            // Sweep
            .addWithdrawal(
              config.treasuryScript.rewardAccount!,
              withdrawAmount,
              Data.Void(),
            )
            .addReferenceInput(treasuryRefInput)
            .payLovelace(addr, withdrawAmount, Data.Void())
            // Malformed
            .addReferenceInput(registryInput)
            .addReferenceInput(vendorRefInput)
            .addInput(
              vendorInput,
              Data.serialize(VendorSpendRedeemer, "Malformed"),
            )
            .lockAssets(
              config.treasuryScript.scriptAddress,
              vendorInput.output().amount(),
              Data.Void(),
            ),
          /Trace expect None =\s*inputs\s*|> list.find\(\s*fn\(input\) {\s*or {\s*input.address.payment_credential == registry.treasury,/,
        );
      });
    });
  });

  describe("3.7", () => {
    async function mockVendorDatum(
      emulator: Emulator,
      vendorCount: number,
      payoutCount: number,
      valueSize: number,
    ): Promise<
      [
        MultisigScript,
        VendorDatum,
        Array<{ date: Date; amount: Core.Value }>,
        Core.Value,
      ]
    > {
      const vendor: MultisigScript = {
        AllOf: {
          scripts: [],
        },
      };
      const vendorKey = await vendor_key(emulator);
      for (let i = 0; i < vendorCount; i++) {
        vendor.AllOf.scripts.push({ Signature: { key_hash: vendorKey } });
      }
      const datum: VendorDatum = {
        vendor,
        payouts: [],
      };
      const schedule = Array<{ date: Date; amount: Core.Value }>();

      let totalValue = Value.zero();
      for (let i = 0; i < payoutCount; i++) {
        // set all payout's maturation to 1h before treasury expiratoin
        const assets: [string, bigint][] = [];
        for (let j = 0; j < valueSize; j++) {
          const policyId = `${"0".repeat(50)}${Number(j).toString().padStart(6, "0")}`;
          assets.push([policyId, 1_000_000n]);
        }
        const value = makeValue(1_000_000n, ...assets);
        totalValue = Value.merge(totalValue, value);
        const translatedValue = coreValueToContractsValue(value);

        datum.payouts.push({
          maturation: 0n,
          value: translatedValue,
          status: "Active",
        });

        schedule.push({
          date: new Date(Number(slot_to_unix(Core.Slot(0)))),
          amount: value,
        });
      }
      return [vendor, datum, schedule, totalValue];
    }

    // Benchmarking shows that we hit execution unit limits at around:
    // - 35 payouts with 3 tokens (+ ada) in each value;
    // - 24 payouts with 5 tokens (+ ada) in each value;
    // So setting 24 payouts (twice a month for a year) with at most 3 tokens (USDM + USDA + one other) (plus ADA)
    // seems gives us some wiggle room.
    // If we need more than that, we can always split across multiple projects
    test("cannot permanently deadlock funds in projects with more than 24 payouts", async () => {
      const configs = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, configs);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [vendor, _, schedule, value] = await mockVendorDatum(
        emulator,
        1,
        25,
        3,
      );
      const treasuryInput = scriptOutput(
        emulator,
        configs.treasuryScript,
        value,
        Data.Void(),
      );
      await emulator.as(Funder, async (blaze) => {
        const tx = await fund(
          {
            treasury: configs.treasuryScript.config,
            vendor: configs.vendorScript.config,
          },
          blaze,
          treasuryInput,
          vendor,
          schedule,
          [
            Core.Ed25519KeyHashHex(await fund_key(emulator)),
            Core.Ed25519KeyHashHex(await vendor_key(emulator)),
          ],
        );
        emulator.expectScriptFailure(tx, /Trace expect payout_count <= 24/);
      });
    });
    test("cannot permanently deadlock funds in projects with more than 3 tokens", async () => {
      const configs = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, configs);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [vendor, _, schedule, value] = await mockVendorDatum(
        emulator,
        1,
        24,
        4,
      );
      const treasuryInput = scriptOutput(
        emulator,
        configs.treasuryScript,
        value,
        Data.Void(),
      );
      await emulator.as(Funder, async (blaze) => {
        const tx = await fund(
          {
            treasury: configs.treasuryScript.config,
            vendor: configs.vendorScript.config,
          },
          blaze,
          treasuryInput,
          vendor,
          schedule,
          [
            Core.Ed25519KeyHashHex(await fund_key(emulator)),
            Core.Ed25519KeyHashHex(await vendor_key(emulator)),
          ],
        );
        emulator.expectScriptFailure(
          tx,
          /Trace expect 4 >= \( value |> assets.flatten |> list.length \)/,
        );
      });
    });
    test("cannot permanently deadlock funds in modified projects with more than 24 payouts", async () => {
      const configs = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, configs);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, smallVendorDatum, __] = await mockVendorDatum(
        emulator,
        1,
        1,
        1,
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [___, largeVendorDatum, ____, largeValue] = await mockVendorDatum(
        emulator,
        1,
        25,
        1,
      );
      const vendorInput = scriptOutput(
        emulator,
        configs.vendorScript,
        largeValue,
        Data.serialize(VendorDatum, smallVendorDatum),
      );

      await emulator.as(Modifier, async (blaze) => {
        const tx = await modify(
          {
            treasury: configs.treasuryScript.config,
            vendor: configs.vendorScript.config,
          },
          blaze,
          new Date(Number(slot_to_unix(Core.Slot(0)))),
          vendorInput,
          largeVendorDatum,
          [
            Core.Ed25519KeyHashHex(await modify_key(emulator)),
            Core.Ed25519KeyHashHex(await vendor_key(emulator)),
          ],
        );
        emulator.expectScriptFailure(tx, /Trace expect payout_count <= 24/);
      });
    });
    test("cannot permanently deadlock funds in modified projects with more than 3 tokens", async () => {
      const configs = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, configs);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, smallVendorDatum, __] = await mockVendorDatum(
        emulator,
        1,
        1,
        1,
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [___, largeVendorDatum, ____, largeValue] = await mockVendorDatum(
        emulator,
        1,
        1,
        4,
      );
      const vendorInput = scriptOutput(
        emulator,
        configs.vendorScript,
        largeValue,
        Data.serialize(VendorDatum, smallVendorDatum),
      );

      await emulator.as(Modifier, async (blaze) => {
        const tx = await modify(
          {
            treasury: configs.treasuryScript.config,
            vendor: configs.vendorScript.config,
          },
          blaze,
          new Date(Number(slot_to_unix(Core.Slot(0)))),
          vendorInput,
          largeVendorDatum,
          [
            Core.Ed25519KeyHashHex(await modify_key(emulator)),
            Core.Ed25519KeyHashHex(await vendor_key(emulator)),
          ],
        );
        emulator.expectScriptFailure(
          tx,
          /Trace expect 4 >= \( value |> assets.flatten |> list.length \)/,
        );
      });
    });
  });

  describe("3.8", () => {
    test("cannot modify payouts that have matured more than 36 hours ago", async () => {
      const scripts = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, scripts);
      const refInput = emulator.lookupScript(
        scripts.vendorScript.script.Script,
      );
      const registryInput = findRegistryInput(emulator);
      const vendor = {
        Signature: {
          key_hash: await vendor_key(emulator),
        },
      };
      const vendorDatum: VendorDatum = {
        vendor: vendor,
        payouts: [
          {
            maturation: 1000n,
            status: "Active",
            value: coreValueToContractsValue(makeValue(40_000_000n)),
          },
        ],
      };
      const vendorInput = scriptOutput(
        emulator,
        scripts.vendorScript,
        makeValue(200_000_000n),
        Data.serialize(VendorDatum, vendorDatum),
      );
      const pausedVendorDatum: VendorDatum = {
        vendor: vendor,
        payouts: [
          {
            maturation: 1000n,
            status: "Paused",
            value: coreValueToContractsValue(makeValue(40_000_000n)),
          },
        ],
      };

      // Advance forward by 36 hours
      emulator.stepForwardToSlot(36 * 60 * 60 + 10);

      await emulator.as(Pauser, async (blaze) => {
        await emulator.expectScriptFailure(
          blaze
            .newTransaction()
            .addInput(
              vendorInput,
              Data.serialize(VendorSpendRedeemer, {
                Adjudicate: {
                  statuses: ["Paused"],
                },
              }),
            )
            .lockAssets(
              scripts.vendorScript.scriptAddress,
              makeValue(200_000_000n),
              Data.serialize(VendorDatum, pausedVendorDatum),
            )
            .addRequiredSigner(Ed25519KeyHashHex(await pause_key(emulator)))
            .setValidFrom(Core.Slot(0))
            .setValidUntil(Core.Slot(36 * 60 * 60 + 20))
            .addReferenceInput(refInput)
            .addReferenceInput(registryInput),
          /Trace interval_length_at_most\(validity_range, thirty_six_hours\) \? False/,
        );
      });
    });
  });

  describe("3.10", () => {
    test("cannot create underfunded project during modification", async () => {
      const config = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, config);

      const vendor = {
        Signature: {
          key_hash: await vendor_key(emulator),
        },
      };
      const modifySigner = Ed25519KeyHashHex(await modify_key(emulator));
      const vendorSigner = Ed25519KeyHashHex(await vendor_key(emulator));
      const vendorDatum: VendorDatum = {
        vendor: vendor,
        payouts: [
          {
            maturation: 0n,
            status: "Active",
            value: coreValueToContractsValue(makeValue(500_000_000_000n)),
          },
        ],
      };
      const vendorInput = scriptOutput(
        emulator,
        config.vendorScript,
        makeValue(500_000_000_000n),
        Data.serialize(VendorDatum, vendorDatum),
      );

      const vendorRefInput = emulator.lookupScript(
        config.vendorScript.script.Script,
      );
      const registryInput = findRegistryInput(emulator);
      const invalidDatum: VendorDatum = {
        vendor: vendor,
        payouts: [
          {
            maturation: 0n,
            status: "Active",
            value: coreValueToContractsValue(makeValue(500_000_000_100n)),
          },
        ],
      };
      await emulator.as(Modifier, async (blaze) => {
        emulator.expectScriptFailure(
          blaze
            .newTransaction()
            .addReferenceInput(registryInput)
            .addReferenceInput(vendorRefInput)
            .setValidFrom(Core.Slot(0))
            .setValidUntil(Core.Slot(100))
            .addInput(
              vendorInput,
              Data.serialize(VendorSpendRedeemer, "Modify"),
            )
            .lockAssets(
              config.vendorScript.scriptAddress,
              makeValue(500_000_000_000n),
              Data.serialize(VendorDatum, invalidDatum),
            )
            .addRequiredSigner(modifySigner)
            .addRequiredSigner(vendorSigner),
          /Trace expect equal_plus_min_ada\(this_payout_sum, output.value\)/,
        );
      });
    });
  });

  describe("3.11", () => {
    test("cannot create a vendor project with an invalid vendor", async () => {
      const configs = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, configs);
      const treasuryInput = scriptOutput(
        emulator,
        configs.treasuryScript,
        makeValue(100_000_000n),
        Data.Void(),
      );
      const vendor: MultisigScript = {
        // AnyOf uses list.any, so an empty list always fails
        AnyOf: {
          scripts: [],
        },
      };
      await emulator.as(Funder, async (blaze) => {
        emulator.expectScriptFailure(
          await fund(
            {
              treasury: configs.treasuryScript.config,
              vendor: configs.vendorScript.config,
            },
            blaze,
            treasuryInput,
            vendor,
            [
              {
                date: new Date(Number(slot_to_unix(Core.Slot(10)))),
                amount: makeValue(100_000_000n),
              },
            ],
            [Ed25519KeyHashHex(await fund_key(emulator))],
          ),
          /Trace expect\s*satisfied\(v.vendor,/,
        );
      });
    });
    test("cannot create a vendor project with a payout past the payout upperbound", async () => {
      const configs = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, configs);
      const treasuryInput = scriptOutput(
        emulator,
        configs.treasuryScript,
        makeValue(100_000_000n),
        Data.Void(),
      );
      const vendor: MultisigScript = {
        // AnyOf uses list.any, so an empty list always fails
        Signature: {
          key_hash: await vendor_key(emulator),
        },
      };
      await emulator.as(Funder, async (blaze) => {
        emulator.expectScriptFailure(
          await fund(
            {
              treasury: configs.treasuryScript.config,
              vendor: configs.vendorScript.config,
            },
            blaze,
            treasuryInput,
            vendor,
            [
              {
                date: new Date(
                  Number(
                    configs.treasuryScript.config.payout_upperbound + 1000n,
                  ),
                ),
                amount: makeValue(100_000_000n),
              },
            ],
            [
              Ed25519KeyHashHex(await fund_key(emulator)),
              Ed25519KeyHashHex(await vendor_key(emulator)),
            ],
          ),
          /Trace expect p.maturation <= config.payout_upperbound/,
        );
      });
    });
  });
});
