import { IMetadataBodyBase } from "../shared.js";
import { ETransactionEvent } from "./events.js";

export interface IOutput {
  identifier: string;
  label?: string;
}

interface IInitializeReorganize extends IMetadataBodyBase {
  reason?: string;
  outputs: Record<number, IOutput>;
}

export interface IInitialize extends IInitializeReorganize {
  event: ETransactionEvent.INITIALIZE;
}

export interface IReorganize extends IInitializeReorganize {
  event: ETransactionEvent.REORGANIZE;
}
