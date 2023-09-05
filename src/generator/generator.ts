import { 
    DefaultObject, 
    GetConditionStringResult, 
    GetInsertStringResult, 
    GetLimitOffsetStringResult, 
    GetRangeStringResult, 
    GetSetStringResult, 
    LimitOffsetArgs, 
    ObjectToStringResult,
    RangeArgs
} from "src/@types/types";

class SqlGenerator {
    camelToSnakeCase(str: string): string {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }

    snakeToCamelCase(str: string): string {
        return str
            .replace(/^_+/g, '')
            .replace(/_+$/g, '')
            .replace(/_[a-zA-Z]/g, substr => substr[substr.length - 1].toUpperCase());
    }

    camelcaseKeys<T extends DefaultObject>(input: T): T;
    camelcaseKeys<T extends DefaultObject>(input: T[]): T[];
    camelcaseKeys<T extends DefaultObject>(input: any): any {
        const camelcaseKeysObj = (object: DefaultObject): DefaultObject => {
            const result: any = {};
            Object.keys(object).forEach(key => result[this.snakeToCamelCase(key)] = object[key]);

            return result;
        }

        return Array.isArray(input)
            ? input.map(obj => camelcaseKeysObj(obj))
            : camelcaseKeysObj(input);
    }

    objectToString(object: DefaultObject, joinSubstring: string, start: number = 1): ObjectToStringResult {
        const entries = Object.entries(object);
        const filtredEntries = entries.filter(([key, value]) => value !== null && value !== undefined);
        const filtredObject = Object.fromEntries(filtredEntries);

        const keys = Object.keys(filtredObject);
        const values = Object.values(filtredObject);

        const stringObject = keys.map((key, i) => `${this.camelToSnakeCase(key)} = $${i + start}`).join(joinSubstring);
        const lastIndex = start + keys.length;

        return { stringObject, lastIndex, values };
    }

    getConditionString(conditionObject: DefaultObject = {}, start: number = 1): GetConditionStringResult {
        let conditionString = '';
        const { stringObject, lastIndex, values } = this.objectToString(conditionObject, ' AND ', start);
        if (stringObject && start === 1) {
            conditionString = 'WHERE ' + stringObject;
        }

        return { conditionString, lastIndex, conditionValues: values };
    }

    getSetString(object: DefaultObject, start: number = 1): GetSetStringResult {
        const { stringObject, lastIndex, values } = this.objectToString(object, ', ', start);

        return { setString: stringObject, lastIndex, setValues: values };
    }

    getInsertString(object: DefaultObject, start: number = 1): GetInsertStringResult {
        const values = Object.values(object);
        const keys = Object.keys(object).map(key => this.camelToSnakeCase(key));
        const newValues = keys.map((_, i) => `$${i + start}`);

        const insertString = `(${keys.join(', ')}) VALUES (${newValues.join(', ')})`;
        const lastIndex = start + keys.length;

        return { insertString, lastIndex, insertValues: values };
    }

    getLimitOffsetString(args: LimitOffsetArgs, start: number = 1): GetLimitOffsetStringResult {
        let limitOffsetString = '';
        let lastIndex = start;
        let limitOffsetValues: number[] = [];


        if (args.limit) {
            limitOffsetString += `LIMIT $${lastIndex}`;
            lastIndex++;
            limitOffsetValues.push(args.limit);
        }

        if (args.offset) {
            limitOffsetString += ` OFFSET $${lastIndex}`;
            lastIndex++;
            limitOffsetValues.push(args.offset);
        }

        return { limitOffsetString, lastIndex, limitOffsetValues };
    }

    getRangeString(args: RangeArgs, start: number = 1): GetRangeStringResult {
        let rangeString = start === 1 ? 'WHERE ' : '';
        let lastIndex = start;
        let rangeValues: Array<number | string> = [];
        const tsConv = args.toTimestamp ? 'timestamp ' : '';

        if (args.from && args.to) {
            rangeString = `${tsConv}$${lastIndex} < ${args.column} < ${tsConv}$${lastIndex + 1}`;
            lastIndex += 2;
            rangeValues = [args.from, args.to];
        } else if (args.from && !args.to) {
            rangeString = `${tsConv}$${lastIndex} < ${args.column}`;
            lastIndex += 1;
            rangeValues = [args.from];
        } else if (!args.from && args.to) {
            rangeString = `${args.column} < ${tsConv}$${lastIndex}`;
            lastIndex += 1;
            rangeValues = [args.to];
        } else {
            rangeString = '';
        }

        return { rangeString, lastIndex, rangeValues };
    }
}

const sqlGenerator = new SqlGenerator();

export { sqlGenerator };
