import {
  makeValue,
  TxBuilder,
  type Blaze,
  type Provider,
  type Wallet,
} from "@blaze-cardano/sdk";
import {
  AssetId,
  Ed25519KeyHashHex,
  Slot,
  toHex,
  TransactionUnspentOutput,
  Value,
} from "@blaze-cardano/core";
import * as Tx from "@blaze-cardano/tx";
import * as Data from "@blaze-cardano/data";
import {
  coreValueToContractsValue,
  loadTreasuryScript,
  loadVendorScript,
  unix_to_slot,
} from "../../shared";
import {
  VendorDatum,
  MultisigScript,
  TreasuryConfiguration,
  TreasurySpendRedeemer,
  VendorConfiguration,
} from "../../types/contracts";

export async function fund<P extends Provider, W extends Wallet>(
  configs: { treasury: TreasuryConfiguration; vendor: VendorConfiguration },
  blaze: Blaze<P, W>,
  input: TransactionUnspentOutput,
  vendor: MultisigScript,
  schedule: { date: Date; amount: Value }[],
  signers: Ed25519KeyHashHex[],
): Promise<TxBuilder> {
  const { script: vendorScript, scriptAddress: vendorScriptAddress } =
    loadVendorScript(blaze.provider.network, configs.vendor);
  const { script: treasuryScript, scriptAddress: treasuryScriptAddress } =
    loadTreasuryScript(blaze.provider.network, configs.treasury);
  const registryInput = await blaze.provider.getUnspentOutputByNFT(
    AssetId(configs.treasury.registry_token + toHex(Buffer.from("REGISTRY"))),
  );
  const refInput = await blaze.provider.resolveScriptRef(treasuryScript.Script);
  if (!refInput)
    throw new Error("Could not find treasury script reference on-chain");
  let tx = blaze
    .newTransaction()
    .setValidUntil(Slot(Number(configs.treasury.expiration / 1000n) - 1))
    .addReferenceInput(registryInput)
    .addReferenceInput(refInput);

  for (const signer of signers) {
    tx = tx.addRequiredSigner(signer);
  }

  const totalPayout = schedule.reduce(
    (acc, s) => Tx.Value.merge(acc, s.amount),
    makeValue(0n),
  );

  tx = tx.addInput(
    input,
    Data.serialize(TreasurySpendRedeemer, {
      Fund: {
        amount: coreValueToContractsValue(totalPayout),
      },
    }),
  );

  const datum: VendorDatum = {
    vendor,
    payouts: schedule.map((s) => {
      return {
        maturation: BigInt(unix_to_slot(BigInt(s.date.valueOf()))),
        value: coreValueToContractsValue(s.amount),
        status: "Active",
      };
    }),
  };

  tx.lockAssets(
    vendorScriptAddress,
    totalPayout,
    Data.serialize(VendorDatum, datum),
  );

  const remainder = Tx.Value.merge(
    input.output().amount(),
    Tx.Value.negate(totalPayout),
  );
  if (!Tx.Value.empty(remainder)) {
    tx.lockAssets(treasuryScriptAddress, remainder, Data.Void());
  }

  return tx;
}
