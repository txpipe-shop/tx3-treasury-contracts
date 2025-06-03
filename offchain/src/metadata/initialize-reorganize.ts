export interface IOutput {
    identifier: string;
    label?: string;
}

interface IInitializeReorganize {
    reason?: string;
    outputs: Record<number, IOutput>;
}

export interface IInitialize extends IInitializeReorganize {
    event: "initialize";
}

export interface IReorganize extends IInitializeReorganize {
    event: "reorganize";
}