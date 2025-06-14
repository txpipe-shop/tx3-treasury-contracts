import {
  AssetId,
  AuxiliaryData,
  Ed25519KeyHashHex,
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
} from "../../generated-types/contracts.js";
import { ITransactionMetadata, toTxMetadata } from "../../metadata/shared.js";
import { IFund } from "../../metadata/types/fund.js";
import {
  coreValueToContractsValue,
  ICompiledScripts,
  loadScripts,
} from "../../shared/index.js";

export interface IFundArgs<P extends Provider, W extends Wallet> {
  configs?: {
    treasury: TreasuryConfiguration;
    vendor: VendorConfiguration;
    trace?: boolean;
  };
  scripts?: ICompiledScripts;
  blaze: Blaze<P, W>;
  input: TransactionUnspentOutput;
  vendor: MultisigScript;
  schedule: { date: Date; amount: Value }[];
  signers: Ed25519KeyHashHex[];
  metadata?: ITransactionMetadata<IFund>;
}

export async function fund<P extends Provider, W extends Wallet>({
  blaze,
  configs,
  scripts,
  input,
  schedule,
  signers,
  metadata,
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
      configs.trace,
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
    .setValidUntil(
      blaze.provider.unixToSlot(configs.treasury.expiration - 1000n),
    )
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

  if (metadata) {
    const auxData = new AuxiliaryData();
    auxData.setMetadata(toTxMetadata(metadata));
    tx = tx.setAuxiliaryData(auxData);
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
