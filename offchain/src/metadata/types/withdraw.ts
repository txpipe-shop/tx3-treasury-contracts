import { IAnchor, IMetadataBodyBase } from "../shared.js";
import { ETransactionEvent } from "./events.js";

export interface IAnchorWithLabel extends IAnchor {
  label: string;
}

export interface IMilestone {
  description: string;
  evidence: IAnchorWithLabel[];
}

export interface IWithdraw extends IMetadataBodyBase {
  event: ETransactionEvent.WITHDRAW;
  milestones: Record<string, IMilestone>;
}
