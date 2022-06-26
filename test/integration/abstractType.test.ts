import { readFileSync } from 'fs';
import { join } from 'path';

import { execute, GraphQLSchema, parse } from 'graphql';
import { createSchema } from '../../src';

describe('JiraphQL Abstract Types', () => {
    const schema = createSchema((file) => readFileSync(join(__dirname, 'documents', file)).toString()) as GraphQLSchema;

    it('can resolve an union of primary types', () => {
        const result = execute({
            schema,
            document: parse(`
                query {
                    primaryTypeUnion {
                        ... on PrimaryType {
                            name
                            value
                        }
                        ... on SecondPrimaryType {
                            test
                            value
                        }
                    }
                }
            `),
        });

        expect(result).toEqual({
            data: {
                primaryTypeUnion: [
                    {
                        name: 'test2',
                        value: 20,
                    },
                    {
                        test: 100,
                        value: 100,
                    },
                ],
            },
        });
    });

    it('can resolve an union of mixed types', () => {
        const result = execute({
            schema,
            document: parse(`
                query {
                    mixedTypeUnion {
                        ... on ValueType {
                            booleanValue
                            intValue
                            nullableValue
                            stringValue
                            valueType
                        }
                        ... on PrimaryType {
                            name
                            value
                        }
                        ... on SecondPrimaryType {
                            test
                            value
                        }
                    }
                }
            `),
        });

        expect(result).toEqual({
            data: {
                mixedTypeUnion: [
                    {
                        booleanValue: false,
                        intValue: 1,
                        nullableValue: 1,
                        stringValue: 'test1',
                        valueType: null,
                    },
                    {
                        name: 'test2',
                        value: 20,
                    },
                    {
                        test: 100,
                        value: 100,
                    },
                ],
            },
        });
    });

    it('can resolve an interface of primary types', () => {
        const result = execute({
            schema,
            document: parse(`
                query {
                    primaryTypeInterface {
                        ... on PrimaryType {
                            name
                            value
                        }
                        ... on SecondPrimaryType {
                            test
                            value
                        }
                    }
                }
            `),
        });

        expect(result).toEqual({
            data: {
                primaryTypeInterface: [
                    {
                        name: 'test2',
                        value: 20,
                    },
                    {
                        test: 100,
                        value: 100,
                    },
                ],
            },
        });
    });

    it('can resolve an interface of mixed types', () => {
        const result = execute({
            schema,
            document: parse(`
                query {
                    mixedTypeInterface {
                        ... on ValueType {
                            booleanValue
                            intValue
                            nullableValue
                            stringValue
                            valueType
                        }
                        ... on PrimaryType {
                            name
                            value
                        }
                        ... on SecondPrimaryType {
                            test
                            value
                        }
                    }
                }
            `),
        });

        expect(result).toEqual({
            data: {
                mixedTypeInterface: [
                    {
                        booleanValue: false,
                        intValue: 1,
                        nullableValue: 1,
                        stringValue: 'test1',
                        valueType: null,
                    },
                    {
                        name: 'test2',
                        value: 20,
                    },
                    {
                        test: 100,
                        value: 100,
                    },
                ],
            },
        });
    });
});
