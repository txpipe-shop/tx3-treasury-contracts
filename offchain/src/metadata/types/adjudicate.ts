import { IMetadataBodyBase } from "../shared";
import { ETransactionEvent } from "./events";

export interface IMilestone {
  reason: string;
  resolution?: string;
}

interface IAdjudicate extends IMetadataBodyBase {
  milestones: Record<string, IMilestone>;
}

export interface IPause extends IAdjudicate {
  event: ETransactionEvent.PAUSE;
}

export interface IResume extends IAdjudicate {
  event: ETransactionEvent.RESUME;
}
