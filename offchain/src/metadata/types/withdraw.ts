import { IAnchor, IMetadataBodyBase } from "../shared";
import { ETransactionEvent } from "./events";

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
