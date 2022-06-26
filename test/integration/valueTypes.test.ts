import { readFileSync } from 'fs';
import { join } from 'path';

import { execute, GraphQLSchema, parse } from 'graphql';
import { createSchema } from '../../src';

describe('JiraphQL Value Type', () => {
    const schema = createSchema((file) => readFileSync(join(__dirname, 'documents', file)).toString()) as GraphQLSchema;

    it('can get sub value type fields.', () => {
        const result = execute({
            schema,
            document: parse(`
                query {
                    valueTypes {
                        booleanValue
                        intValue
                        nullableValue
                        stringValue
                    }
                }
            `),
        });

        expect(result).toEqual({
            data: {
                valueTypes: [
                    {
                        booleanValue: false,
                        intValue: 1,
                        nullableValue: 1,
                        stringValue: 'test1',
                    },
                    {
                        booleanValue: true,
                        intValue: 2,
                        nullableValue: null,
                        stringValue: 'test2',
                    },
                ],
            },
        });
    });

    it('can descend multiple layers', () => {
        const result = execute({
            schema,
            document: parse(`
                query {
                    valueTypes {
                        valueType {
                            valueType {
                                booleanValue
                                intValue
                                nullableValue
                                stringValue
                                valueType {
                                    booleanValue
                                }
                            }
                        }
                    }
                }
            `),
        });

        expect(result).toEqual({
            data: {
                valueTypes: [
                    {
                        valueType: null,
                    },
                    {
                        valueType: {
                            valueType: {
                                booleanValue: true,
                                intValue: 4,
                                nullableValue: null,
                                stringValue: 'test4',
                                valueType: null,
                            },
                        },
                    },
                ],
            },
        });
    });

    it('can go to a PrimaryType', () => {
        const result = execute({
            schema,
            document: parse(`
                query {
                    valueTypes {
                        primaryType {
                            name
                        }
                    }
                }
            `),
        });

        expect(result).toEqual({
            data: {
                valueTypes: [
                    {
                        primaryType: {
                            name: 'test1',
                        },
                    },
                    {
                        primaryType: {
                            name: 'test2',
                        },
                    },
                ],
            },
        });
    });
});
