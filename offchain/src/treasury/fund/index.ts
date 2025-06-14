import {
  AssetId,
  Ed25519KeyHashHex,
  Script,
  Slot,
  toHex,
  TransactionUnspentOutput,
  Value,
} from "@blaze-cardano/core";
import * as Data from "@blaze-cardano/data";
import {
  makeValue,
  TxBuilder,
  type Blaze,
  type Provider,
  type Wallet,
} from "@blaze-cardano/sdk";
import * as Tx from "@blaze-cardano/tx";
import {
  MultisigScript,
  TreasuryConfiguration,
  TreasurySpendRedeemer,
  VendorConfiguration,
  VendorDatum,
} from "../../generated-types/contracts";
import {
  coreValueToContractsValue,
  ICompiledScripts,
  loadScripts,
  loadTreasuryScript,
  loadVendorScript,
} from "../../shared";

export interface IFundArgs<P extends Provider, W extends Wallet> {
  configs?: { treasury: TreasuryConfiguration; vendor: VendorConfiguration };
  scripts?: ICompiledScripts;
  blaze: Blaze<P, W>;
  input: TransactionUnspentOutput;
  vendor: MultisigScript;
  schedule: { date: Date; amount: Value }[];
  signers: Ed25519KeyHashHex[];
}

export async function fund<P extends Provider, W extends Wallet>({
  blaze,
  configs,
  scripts,
  input,
  schedule,
  signers,
  vendor,
}: IFundArgs<P, W>): Promise<TxBuilder> {
  if (!configs && !scripts) {
    throw new Error("Either configs or scripts must be provided");
  }
  if (configs) {
    scripts = loadScripts(
      blaze.provider.network,
      configs.treasury,
      configs.vendor,
    );
  } else if (scripts) {
    configs = {
      treasury: scripts.treasuryScript.config,
      vendor: scripts.vendorScript.config,
    };
  }
  if (!configs || !scripts) {
    throw new Error("Couldn't load scripts");
  }
  const registryInput = await blaze.provider.getUnspentOutputByNFT(
    AssetId(configs.treasury.registry_token + toHex(Buffer.from("REGISTRY"))),
  );

  let tx = blaze
    .newTransaction()
    .setValidUntil(Slot(Number(configs.treasury.expiration / 1000n) - 1))
    .addReferenceInput(registryInput);

  if (!scripts.treasuryScript.scriptRef) {
    scripts.treasuryScript.scriptRef = await blaze.provider.resolveScriptRef(
      scripts.treasuryScript.script.Script,
    );
  }
  if (scripts.treasuryScript.scriptRef) {
    tx.addReferenceInput(scripts.treasuryScript.scriptRef);
  } else {
    tx.provideScript(scripts.treasuryScript.script.Script);
  }

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
        maturation: BigInt(s.date.valueOf()),
        value: coreValueToContractsValue(s.amount),
        status: "Active",
      };
    }),
  };

  tx.lockAssets(
    scripts.vendorScript.scriptAddress,
    totalPayout,
    Data.serialize(VendorDatum, datum),
  );

  const remainder = Tx.Value.merge(
    input.output().amount(),
    Tx.Value.negate(totalPayout),
  );
  if (!Tx.Value.empty(remainder)) {
    tx.lockAssets(scripts.treasuryScript.scriptAddress, remainder, Data.Void());
  }

  return tx;
}
