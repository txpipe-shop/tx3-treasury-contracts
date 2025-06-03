export interface IOutput {
    identifier: string;
    label?: string;
}

export type OutputMap = Record<number, IOutput>;

interface IInitializeReorganize {
    reason?: string;
    outputs: OutputMap;
}

export interface IInitialize extends IInitializeReorganize {
    event: "initialize";
}

export interface IReorganize extends IInitializeReorganize {
    event: "reorganize";
}