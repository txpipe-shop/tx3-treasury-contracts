import type { INewInstance } from "../src/metadata/new-instance";

export interface IInstanceWithUtxo extends INewInstance {
  utxo: {
    transaction_id: string;
    output_index: bigint;
  };
}
