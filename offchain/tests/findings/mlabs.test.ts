import * as Data from "@blaze-cardano/data";
import { Emulator } from "@blaze-cardano/emulator";
import { Core, makeValue, Value } from "@blaze-cardano/sdk";
import { Ed25519KeyHashHex } from "@cardano-sdk/crypto";
import { beforeEach, describe, test } from "bun:test";
import { fund } from "src/treasury";
import { modify } from "src/vendor";
import {
  MultisigScript,
  TreasurySpendRedeemer,
  VendorDatum,
  VendorSpendRedeemer,
} from "../../src/generated-types/contracts";
import {
  coreValueToContractsValue,
  loadScripts,
  slot_to_unix,
  unix_to_slot,
} from "../../src/shared";
import {
  deployScripts,
  findRegistryInput,
  fund_key,
  Funder,
  Modifier,
  modify_key,
  pause_key,
  Pauser,
  reorganize_key,
  Reorganizer,
  sampleTreasuryConfig,
  sampleVendorConfig,
  scriptOutput,
  setupEmulator,
  Vendor,
  vendor_key,
} from "../utilities";

describe("MLabs Audit Findings", () => {
  let emulator: Emulator;
  beforeEach(async () => {
    emulator = await setupEmulator(undefined, false);
  });

  describe("3.4", () => {
    test("cannot steal funds meant to be swept through double satisfaction with other treasury instances", async () => {
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
    test("cannot steal funds double satisfied during sweep using malformed vendor datums", async () => {
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
        const tx = await fund({
          configs: {
            treasury: configs.treasuryScript.config,
            vendor: configs.vendorScript.config,
          },
          blaze,
          input: treasuryInput,
          vendor,
          schedule,
          signers: [
            Core.Ed25519KeyHashHex(await fund_key(emulator)),
            Core.Ed25519KeyHashHex(await vendor_key(emulator)),
          ],
        });
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
        const tx = await fund({
          configs: {
            treasury: configs.treasuryScript.config,
            vendor: configs.vendorScript.config,
          },
          blaze,
          input: treasuryInput,
          vendor,
          schedule,
          signers: [
            Core.Ed25519KeyHashHex(await fund_key(emulator)),
            Core.Ed25519KeyHashHex(await vendor_key(emulator)),
          ],
        });
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

  describe("3.9", () => {
    test("is not forced to steal native assets when modifying", async () => {
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
        vendor,
        payouts: [
          {
            maturation: 1000n,
            value: coreValueToContractsValue(makeValue(10_000_000n)),
            status: "Active",
          },
          {
            maturation: 2000n,
            value: coreValueToContractsValue(
              makeValue(10_000_000n, ["a".repeat(56), 1n]),
            ),
            status: "Active",
          },
          {
            maturation: 10000n,
            value: coreValueToContractsValue(makeValue(10_000_000n)),
            status: "Active",
          },
        ],
      };
      const vendorInput = scriptOutput(
        emulator,
        scripts.vendorScript,
        makeValue(30_000_000n, ["a".repeat(56), 1n]),
        Data.serialize(VendorDatum, vendorDatum),
      );
      const tx = await emulator.as(Modifier, async (blaze) => {
        const now = new Date(Number(slot_to_unix(Core.Slot(3))));

        emulator.stepForwardToSlot(3);

        const newDatum: VendorDatum = {
          vendor: vendor,
          payouts: [
            {
              maturation: 1000n,
              value: coreValueToContractsValue(makeValue(10_000_000n)),
              status: "Active",
            },
            {
              maturation: 2000n,
              value: coreValueToContractsValue(
                makeValue(10_000_000n, ["a".repeat(56), 1n]),
              ),
              status: "Active",
            },
            {
              maturation: 11000n,
              value: coreValueToContractsValue(makeValue(10_000_000n)),
              status: "Active",
            },
          ],
        };

        return blaze
          .newTransaction()
          .addReferenceInput(registryInput)
          .addReferenceInput(refInput)
          .setValidFrom(unix_to_slot(BigInt(now.valueOf())))
          .setValidUntil(
            unix_to_slot(BigInt(now.valueOf()) + 36n * 60n * 60n * 1000n),
          )
          .addInput(vendorInput, Data.serialize(VendorSpendRedeemer, "Modify"))
          .addRequiredSigner(Ed25519KeyHashHex(await modify_key(emulator)))
          .addRequiredSigner(Ed25519KeyHashHex(await vendor_key(emulator)))
          .lockAssets(
            scripts.vendorScript.scriptAddress,
            makeValue(30_000_000n, ["a".repeat(56), 1n]),
            Data.serialize(VendorDatum, newDatum),
          );
      });
      await emulator.expectValidMultisignedTransaction([Modifier, Vendor], tx);
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
          await fund({
            configs: {
              treasury: configs.treasuryScript.config,
              vendor: configs.vendorScript.config,
            },
            blaze,
            input: treasuryInput,
            vendor,
            schedule: [
              {
                date: new Date(Number(slot_to_unix(Core.Slot(10)))),
                amount: makeValue(100_000_000n),
              },
            ],
            signers: [Ed25519KeyHashHex(await fund_key(emulator))],
          }),
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
        Signature: {
          key_hash: await vendor_key(emulator),
        },
      };
      await emulator.as(Funder, async (blaze) => {
        emulator.expectScriptFailure(
          await fund({
            configs: {
              treasury: configs.treasuryScript.config,
              vendor: configs.vendorScript.config,
            },
            blaze,
            input: treasuryInput,
            vendor,
            schedule: [
              {
                date: new Date(
                  Number(
                    configs.treasuryScript.config.payout_upperbound + 1000n,
                  ),
                ),
                amount: makeValue(100_000_000n),
              },
            ],
            signers: [
              Ed25519KeyHashHex(await fund_key(emulator)),
              Ed25519KeyHashHex(await vendor_key(emulator)),
            ],
          }),
          /Trace expect p.maturation <= config.payout_upperbound/,
        );
      });
    });
  });

  describe("3.12", () => {
    test("cannot modify a vendor project to have an invalid vendor", async () => {
      const configs = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, configs);
      const validVendor: MultisigScript = {
        Signature: {
          key_hash: await vendor_key(emulator),
        },
      };
      const invalidVendor: MultisigScript = {
        // AnyOf uses list.any, so an empty list always fails
        AnyOf: {
          scripts: [],
        },
      };
      const vendorDatum: VendorDatum = {
        vendor: validVendor,
        payouts: [
          {
            maturation: 0n,
            status: "Active",
            value: coreValueToContractsValue(makeValue(100_000_000n)),
          },
        ],
      };
      const invalidVendorDatum: VendorDatum = {
        vendor: invalidVendor,
        payouts: vendorDatum.payouts,
      };
      const vendorInput = scriptOutput(
        emulator,
        configs.vendorScript,
        makeValue(100_000_000n),
        Data.serialize(VendorDatum, vendorDatum),
      );
      await emulator.as(Funder, async (blaze) => {
        await emulator.expectScriptFailure(
          await modify(
            {
              treasury: configs.treasuryScript.config,
              vendor: configs.vendorScript.config,
            },
            blaze,
            new Date(Number(slot_to_unix(Core.Slot(0)))),
            vendorInput,
            invalidVendorDatum,
            [
              Ed25519KeyHashHex(await fund_key(emulator)),
              Ed25519KeyHashHex(await vendor_key(emulator)),
            ],
          ),
          /Trace expect\s*satisfied\(v.vendor,/,
        );
      });
    });
    test("cannot modify a vendor project to have a payout past the payout upperbound", async () => {
      const configs = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, configs);
      const validVendor: MultisigScript = {
        Signature: {
          key_hash: await vendor_key(emulator),
        },
      };
      const vendorDatum: VendorDatum = {
        vendor: validVendor,
        payouts: [
          {
            maturation: 0n,
            status: "Active",
            value: coreValueToContractsValue(makeValue(100_000_000n)),
          },
        ],
      };
      const vendorInput = scriptOutput(
        emulator,
        configs.vendorScript,
        makeValue(100_000_000n),
        Data.serialize(VendorDatum, vendorDatum),
      );
      const newVendorDatum: VendorDatum = {
        vendor: validVendor,
        payouts: [
          {
            maturation: configs.treasuryScript.config.payout_upperbound * 2n,
            status: "Active",
            value: coreValueToContractsValue(makeValue(100_000_000n)),
          },
        ],
      };
      await emulator.as(Funder, async (blaze) => {
        emulator.expectScriptFailure(
          await modify(
            {
              treasury: configs.treasuryScript.config,
              vendor: configs.vendorScript.config,
            },
            blaze,
            new Date(Number(slot_to_unix(Core.Slot(0)))),
            vendorInput,
            newVendorDatum,
            [
              Ed25519KeyHashHex(await fund_key(emulator)),
              Ed25519KeyHashHex(await vendor_key(emulator)),
            ],
          ),
          // Note: becauae of the awkwardness of getting payout_upperbound into the vendor script
          // we accept the use of config.expiration here; this is envisioned to be a short time
          // after the payout upper bound, so technically the committee and the vendor could
          // delay the sweep of funds by a small amount; but this is expected to be relatively small
          // and doesn't meaningfully change the security of the contracts
          /Trace expect p.maturation <= config.expiration/,
        );
      });
    });
  });

  describe("3.13", () => {
    test("cannot pause vendor funds which matured in the distant past", async () => {
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

  describe("3.14", () => {
    test("cannot steal treasury funds while reorganizing using malformed vendor funds", async () => {
      const scripts = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, scripts);
      const treasuryRefInput = emulator.lookupScript(
        scripts.treasuryScript.script.Script,
      );
      const vendorRefInput = emulator.lookupScript(
        scripts.vendorScript.script.Script,
      );
      const registryInput = findRegistryInput(emulator);
      const vendorOutput = scriptOutput(
        emulator,
        scripts.vendorScript,
        makeValue(5_000_000n),
        Data.Void(),
      );
      const treasuryOutput = scriptOutput(
        emulator,
        scripts.treasuryScript,
        makeValue(5_000_000n),
        Data.Void(),
      );
      emulator.as(Reorganizer, async (blaze) => {
        await emulator.expectScriptFailure(
          blaze
            .newTransaction()
            .addReferenceInput(treasuryRefInput)
            .addReferenceInput(vendorRefInput)
            .addReferenceInput(registryInput)
            .addInput(
              treasuryOutput,
              Data.serialize(TreasurySpendRedeemer, "Reorganize"),
            )
            .addInput(
              vendorOutput,
              Data.serialize(VendorSpendRedeemer, "Malformed"),
            )
            .lockAssets(
              scripts.treasuryScript.scriptAddress,
              makeValue(5_000_000n),
              Data.Void(),
            )
            .addRequiredSigner(
              Ed25519KeyHashHex(await reorganize_key(emulator)),
            ),
          /Trace expect\s*option.is_none\(\s*inputs\s*|> list.find\(\s*fn\(input\) \{ input.address.payment_credential == registry.vendor \},/,
        );
      });
    });
  });

  describe("3.15", () => {
    test("cannot attach different staking credential to unswept value in vendor contracts", async () => {
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

      const now = unix_to_slot(scripts.vendorScript.config.expiration * 2n);
      emulator.stepForwardToSlot(now);

      const fullAddress = new Core.Address({
        type: Core.AddressType.BasePaymentScriptStakeKey,
        networkId: Core.NetworkId.Testnet,
        paymentPart: {
          type: Core.CredentialType.ScriptHash,
          hash: scripts.vendorScript.script.Script.hash(),
        },
        delegationPart: {
          type: Core.CredentialType.KeyHash,
          hash: scripts.treasuryScript.script.Script.hash(), // Just use an arbitrary hash
        },
      });

      await emulator.as("Anyone", async (blaze) => {
        emulator.expectScriptFailure(
          blaze
            .newTransaction()
            .addReferenceInput(refInput)
            .addReferenceInput(registryInput)
            .setValidFrom(Core.Slot(now))
            .setValidUntil(Core.Slot(now + 10))
            .addInput(
              vendorInput,
              Data.serialize(VendorSpendRedeemer, "SweepVendor"),
            )
            .lockAssets(
              scripts.treasuryScript.scriptAddress,
              makeValue(160_000_000n),
              Data.Void(),
            )
            .lockAssets(
              fullAddress,
              makeValue(40_000_000n),
              Data.serialize(VendorDatum, vendorDatum),
            ),
          /Trace expect vendor_output.address.stake_credential == Some\(Inline\(account\)\)/,
        );
      });
    });
  });

  describe("3.16 - skipped awaiting clarification", () => {
    test("not forced to provide extra minADA when sweeping asset-only vendor payouts, because spending treasury input is impossible", async () => {
      const scripts = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, scripts);
      const treasuryRefInput = emulator.lookupScript(
        scripts.treasuryScript.script.Script,
      );
      const vendorRefInput = emulator.lookupScript(
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
            maturation: 2000n,
            status: "Paused",
            value: coreValueToContractsValue(
              makeValue(0n, ["a".repeat(56), 50n]),
            ),
          },
          {
            maturation: 10000n,
            status: "Active",
            value: coreValueToContractsValue(
              makeValue(0n, ["a".repeat(56), 50n]),
            ),
          },
        ],
      };
      const treasuryInput = scriptOutput(
        emulator,
        scripts.treasuryScript,
        makeValue(5_000_000n),
        Data.Void(),
      );
      const vendorInput = scriptOutput(
        emulator,
        scripts.vendorScript,
        makeValue(1_409_370n, ["a".repeat(56), 100n]),
        Data.serialize(VendorDatum, vendorDatum),
      );
      const newVendorDatum: VendorDatum = {
        vendor: vendor,
        payouts: [
          {
            maturation: 10000n,
            status: "Active",
            value: coreValueToContractsValue(
              makeValue(0n, ["a".repeat(56), 50n]),
            ),
          },
        ],
      };

      const now = unix_to_slot(scripts.vendorScript.config.expiration * 2n);
      emulator.stepForwardToSlot(now);

      await emulator.as("Anyone", async (blaze) => {
        emulator.expectScriptFailure(
          blaze
            .newTransaction()
            .addReferenceInput(treasuryRefInput)
            .addReferenceInput(vendorRefInput)
            .addReferenceInput(registryInput)
            .setValidFrom(Core.Slot(now))
            .setValidUntil(Core.Slot(now + 10))
            .addInput(
              treasuryInput,
              Data.serialize(TreasurySpendRedeemer, "SweepTreasury"),
            )
            .setDonation(1_000_000n)
            .addInput(
              vendorInput,
              Data.serialize(VendorSpendRedeemer, "SweepVendor"),
            )
            .lockAssets(
              scripts.treasuryScript.scriptAddress,
              makeValue(4_000_000n, ["a".repeat(56), 50n]),
              Data.Void(),
            )
            .lockAssets(
              scripts.vendorScript.scriptAddress,
              makeValue(1_409_370n, ["a".repeat(56), 50n]),
              Data.serialize(VendorDatum, newVendorDatum),
            ),
          /Trace expect\s*option.is_none\(\s*inputs\s*|> list.find\(fn\(input\) { input.address.payment_credential == registry.vendor },/,
        );
      });
    });
  });

  describe("3.17", () => {
    test("cannot DOS the treasury UTxOs after expiration", async () => {
      const scripts = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, scripts);

      const refInput = emulator.lookupScript(
        scripts.treasuryScript.script.Script,
      );
      const registryInput = findRegistryInput(emulator);

      const amount = 100_000_000_000_000n;
      const input = scriptOutput(
        emulator,
        scripts.treasuryScript,
        makeValue(amount),
        Data.Void(),
      );

      const future = scripts.treasuryScript.config.expiration * 2n;
      emulator.stepForwardToSlot(future);

      await emulator.as("Anyone", async (blaze) => {
        await emulator.expectScriptFailure(
          blaze
            .newTransaction()
            .addInput(
              input,
              Data.serialize(TreasurySpendRedeemer, "SweepTreasury"),
            )
            .lockLovelace(
              scripts.treasuryScript.scriptAddress,
              amount - 1n,
              Data.Void(),
            )
            .setValidFrom(unix_to_slot(future))
            .addReferenceInput(refInput)
            .addReferenceInput(registryInput)
            .setDonation(1n),
          /Trace expect input_lovelace - donation <= 5_000_000/,
        );
      });
    });
  });

  describe("4.1", () => {
    test("should use payout upperbound correctly", async () => {
      const scripts = loadScripts(
        Core.NetworkId.Testnet,
        await sampleTreasuryConfig(emulator),
        await sampleVendorConfig(emulator),
      );
      await deployScripts(emulator, scripts);

      const refInput = emulator.lookupScript(
        scripts.treasuryScript.script.Script,
      );
      const registryInput = findRegistryInput(emulator);
      const vendor = {
        Signature: {
          key_hash: await vendor_key(emulator),
        },
      };
      const amount = 100_000_000_000_000n;
      const input = scriptOutput(
        emulator,
        scripts.treasuryScript,
        makeValue(amount),
        Data.Void(),
      );
      await emulator.as(Funder, async (blaze) => {
        const value = coreValueToContractsValue(makeValue(1_000_000n));
        const datum: VendorDatum = {
          vendor,
          payouts: [
            {
              maturation: BigInt(
                scripts.treasuryScript.config.payout_upperbound * 2n,
              ),
              value,
              status: "Active",
            },
          ],
        };
        await emulator.expectScriptFailure(
          blaze
            .newTransaction()
            .setValidUntil(
              Core.Slot(
                Number(
                  scripts.treasuryScript.config.payout_upperbound / 1000n,
                ) - 1,
              ),
            )
            .addReferenceInput(registryInput)
            .addReferenceInput(refInput)
            .addRequiredSigner(Ed25519KeyHashHex(await fund_key(emulator)))
            .addRequiredSigner(Ed25519KeyHashHex(await vendor_key(emulator)))
            .addInput(
              input,
              Data.serialize(TreasurySpendRedeemer, {
                Fund: {
                  amount: value,
                },
              }),
            )
            .lockAssets(
              scripts.vendorScript.scriptAddress,
              makeValue(1_000_000n),
              Data.serialize(VendorDatum, datum),
            )
            .lockAssets(
              scripts.treasuryScript.scriptAddress,
              makeValue(499_999_000_000n),
              Data.Void(),
            ),
          /Trace expect p.maturation <= config.payout_upperbound/,
        );
      });
    });
  });
});
