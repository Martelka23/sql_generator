export interface ObjectToStringResult {
    stringObject: string;
    lastIndex: number;
    values: any[];
}

export interface GetConditionStringResult {
    conditionString: string;
    lastIndex: number;
    conditionValues: any[];
}

export interface GetSetStringResult {
    setString: string;
    lastIndex: number;
    setValues: any[];
}

export interface GetInsertStringResult {
    insertString: string;
    lastIndex: number;
    insertValues: any[];
}

export interface LimitOffsetArgs {
    limit?: number;
    offset?: number;
}

export interface GetLimitOffsetStringResult {
    limitOffsetString: string;
    lastIndex: number;
    limitOffsetValues: number[];
}

export type DefaultObject = Record<string, any>;