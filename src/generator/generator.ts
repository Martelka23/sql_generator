import {
    DefaultObject,
    GetConditionStringArgs,
    GetConditionStringResult,
    GetInsertStringResult,
    GetLimitOffsetStringResult,
    GetRangeStringResult,
    GetSetStringResult,
    LimitOffsetArgs,
    ObjectToStringArgs,
    ObjectToStringResult,
    RangeArgs
} from "../@types/types";


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
            Object.keys(object).forEach(key => {
                let value = object[key];
                if (typeof object[key] === 'object' && (Array.isArray(object[key]) || object[key]?.constructor === Object)) {
                    value = Array.isArray(object[key])
                        ? object[key].map((obj: any) => {
                            return typeof obj === 'object' && obj?.constructor === Object
                                ? camelcaseKeysObj(obj)
                                : obj
                        })
                        : camelcaseKeysObj(object[key]);
                }
                result[this.snakeToCamelCase(key)] = value;
            });

            return result;
        }

        return Array.isArray(input)
            ? input.map(obj => camelcaseKeysObj(obj))
            : camelcaseKeysObj(input);
    }

    objectToString(object: DefaultObject, joinSubstring: string, start: number = 1, args: ObjectToStringArgs): ObjectToStringResult {
        args = {
            convertArrays: false,
            allowNull: false,
            ...args
        };
        const entries = Object.entries(object);
        const filtredEntries = entries.filter(([key, value]) => (args.allowNull || value !== null) && value !== undefined);
        const filtredObject = Object.fromEntries(filtredEntries);

        const keys = Object.keys(filtredObject);
        const values = Object.values(filtredObject);

        const stringObject = keys.map((key, i) => {
            if (args.convertArrays && Array.isArray(filtredObject[key])) {
                return `${this.camelToSnakeCase(key)} = ANY ($${i + start})`;
            } else {
                return `${this.camelToSnakeCase(key)} = $${i + start}`;
            }
        }).join(joinSubstring);
        const lastIndex = start + keys.length;

        return { stringObject, lastIndex, values };
    }

    getConditionString(conditionObject: DefaultObject = {}, start: number = 1, args?: GetConditionStringArgs): GetConditionStringResult {
        let conditionString = '';
        const { stringObject, lastIndex, values } = this.objectToString(conditionObject, ' AND ', start, { convertArrays: true });
        if (stringObject && (start === 1 || args?.withWhere)) {
            conditionString = 'WHERE ' + stringObject;
        } else {
            conditionString = stringObject;
        }

        return { conditionString, lastIndex, conditionValues: values };
    }

    getSetString(object: DefaultObject, start: number = 1): GetSetStringResult {
        const { stringObject, lastIndex, values } = this.objectToString(object, ', ', start, { allowNull: true });
        const setValues = values.map((e: any) => typeof e === 'object' && e !== null ? JSON.stringify(e) : e);

        return { setString: stringObject, lastIndex, setValues };
    }

    getInsertString(object: DefaultObject | DefaultObject[], start: number = 1): GetInsertStringResult {
        if (Array.isArray(object)) {
            const keys = Object.keys(object[0]).map(key => this.camelToSnakeCase(key));
            let insertString = `(${keys.join(', ')}) VALUES`;
            let lastIndex = start;
            let insertValues: any[] = [];

            const insertRows = object.map(obj => {
                const newValues = keys.map((_, i) => `$${i + lastIndex}`);
                lastIndex += keys.length;
                insertValues = [...insertValues, ...Object.values(obj)];

                return `(${newValues.join(', ')})`;
            });
            insertString += ` ${insertRows.join(', ')}`;
            insertValues = insertValues.map((e: any) => e !== undefined ? e : null);

            return { insertString, lastIndex, insertValues };
        } else {
            const values = Object.values(object);
            const keys = Object.keys(object).map(key => this.camelToSnakeCase(key));
            const newValues = keys.map((_, i) => `$${i + start}`);

            const insertString = `(${keys.join(', ')}) VALUES (${newValues.join(', ')})`;
            const lastIndex = start + keys.length;
            const insertValues = values
                .map((e: any) => e !== undefined ? e : null)
                .map((e: any) => typeof e === 'object' && e !== null ? JSON.stringify(e) : e);

            return { insertString, lastIndex, insertValues };
        }
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
        const isMs = args.toTimestamp && args.from?.toString()?.length === 13 || args.to?.toString()?.length === 13;
        const value1 = args.toTimestamp ? `to_timestamp($${lastIndex}${isMs ? '::double precision / 1000' : ''})` : `$${lastIndex}`;
        const value2 = args.toTimestamp ? `to_timestamp($${lastIndex + 1}${isMs ? '::double precision / 1000' : ''})` : `$${lastIndex + 1}`;

        if (args.from && args.to) {
            rangeString += `${value1} < ${args.column}`;
            rangeString += ` AND ${args.column} < ${value2}`;
            lastIndex += 2;
            rangeValues = [args.from, args.to];
        } else if (args.from && !args.to) {
            rangeString += `${value1} < ${args.column}`;
            lastIndex += 1;
            rangeValues = [args.from];
        } else if (!args.from && args.to) {
            rangeString += `${args.column} < ${value1}`;
            lastIndex += 1;
            rangeValues = [args.to];
        } else {
            rangeString = '';
        }

        return { rangeString, lastIndex, rangeValues };
    }

    getOrderByString(columns: string[] | string, order: 'asc' | 'desc' = 'asc'): string {
        let result = '';

        if (Array.isArray(columns)) {
            result = columns.length
                ? `ORDER BY ${columns.join(', ')} ${order}`
                : '';
        } else if (columns) {
            result = `ORDER BY ${columns} ${order}`;
        }

        return result;
    }
}

export const sqlGenerator = new SqlGenerator();

// const a = { a: 1, b: 2 };
// const b = [{ a: 1, b: 2 }];
// const c = [{ a: 1, b: 2 }, { a: 3, b: 4 }, { a: 5, b: 6 }];
// const d: any = { a: 1, b: null, c: undefined };
// const e: any = [{ a: 1, b: null, c: undefined }, { a: 1, b: null, c: undefined }];

// console.log('Insert:')
// console.log(sqlGenerator.getInsertString(a));
// console.log(sqlGenerator.getInsertString(b));
// console.log(sqlGenerator.getInsertString(c));
// console.log(sqlGenerator.getInsertString(d));
// console.log(sqlGenerator.getInsertString(e));

// console.log('Set:')
// console.log(sqlGenerator.getSetString(d));

// console.log('Conditions:');
// console.log(sqlGenerator.getConditionString());
// console.log(sqlGenerator.getConditionString(d));
// console.log(sqlGenerator.getConditionString(a, 2));

// const g: any = [
//     {
//         asdf_dsf: 123,
//         dd_dd: {
//             wer_wer: 'sfds_sdf',
//             d_e: new Date()
//         },
//         fd_df: [
//             {
//                 wer_wer: [
//                     1,
//                     3
//                 ],
//                 d_e: 2
//             },
//             {
//                 wer_wer: 123,
//                 d_e: 2
//             }
//         ]
//     },
//     {
//         asdf_dsf: null,
//         dd_dd: {
//             wer_wer: {
//                 sdf_fdf: 1
//             },
//             d_e: 2
//         },
//         fd_df: [
//             {
//                 wer_wer: null,
//                 d_e: 2
//             },
//             {
//                 wer_wer: 123,
//                 d_e: 2
//             }
//         ]
//     }
// ];
// console.log(JSON.stringify(sqlGenerator.camelcaseKeys(g)));
