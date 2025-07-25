import { TransactionUnspentOutput } from "@blaze-cardano/core";

export const getCollateralUtxo = async (utxos: TransactionUnspentOutput[]) => {
  return utxos.filter((u) => {
    const value = u.toCore()[1].value;
    return value.coins && value.coins >= 5_000_000n && value.assets?.size === 0;
  })[0];
};

export const UtxoToRef = (utxo: TransactionUnspentOutput): string => {
  return `${utxo.toCore()[0].txId}#${utxo.toCore()[0].index}`;
};
