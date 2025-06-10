import {
  Address,
  AssetId,
  Datum,
  Ed25519KeyHashHex,
  Slot,
  toHex,
  TransactionUnspentOutput,
  Value,
} from "@blaze-cardano/core";
import * as Data from "@blaze-cardano/data";
import {
  TxBuilder,
  type Blaze,
  type Provider,
  type Wallet,
} from "@blaze-cardano/sdk";
import * as Tx from "@blaze-cardano/tx";
import {
  TreasuryConfiguration,
  TreasurySpendRedeemer,
  VendorConfiguration,
} from "../../generated-types/contracts";
import { coreValueToContractsValue, loadTreasuryScript } from "../../shared";

export async function disburse<P extends Provider, W extends Wallet>(
  configs: { treasury: TreasuryConfiguration; vendor: VendorConfiguration },
  blaze: Blaze<P, W>,
  input: TransactionUnspentOutput,
  recipient: Address,
  amount: Value,
  datum: Datum | undefined,
  signers: Ed25519KeyHashHex[],
  after: boolean = false,
): Promise<TxBuilder> {
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
    .addReferenceInput(registryInput)
    .addReferenceInput(refInput);

  if (after) {
    tx = tx.setValidFrom(Slot(Number(configs.treasury.expiration / 1000n) + 1));
  } else {
    tx = tx.setValidUntil(
      Slot(Number(configs.treasury.expiration / 1000n) - 1),
    );
  }

  for (const signer of signers) {
    tx = tx.addRequiredSigner(signer);
  }

  tx = tx.addInput(
    input,
    Data.serialize(TreasurySpendRedeemer, {
      Disburse: {
        amount: coreValueToContractsValue(amount),
      },
    }),
  );

  if (datum) {
    tx.lockAssets(recipient, amount, datum);
  } else {
    tx.payAssets(recipient, amount);
  }

  const remainder = Tx.Value.merge(
    input.output().amount(),
    Tx.Value.negate(amount),
  );
  if (!Tx.Value.empty(remainder)) {
    tx.lockAssets(treasuryScriptAddress, remainder, Data.Void());
  }

  return tx;
}
