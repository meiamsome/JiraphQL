import { readFileSync } from 'fs';
import { join } from 'path';

import { execute, GraphQLSchema, parse } from 'graphql';
import { createSchema } from '../../src';

describe('JraphQL Value Type', () => {
    const schema = createSchema((file) => readFileSync(join(__dirname, 'documents', file)).toString()) as GraphQLSchema;

    it('can get sub value type fields.', () => {
        const result = execute({
            schema,
            document: parse(`
                query {
                    primaryTypes {
                        name
                        value
                    }
                }
            `),
        });

        expect(result).toEqual({
            data: {
                primaryTypes: [
                    {
                        name: 'test1',
                        value: 10,
                    },
                    {
                        name: 'test2',
                        value: 20,
                    },
                ],
            },
        });
    });

    it('can get sub value type fields without the key fields', () => {
        const result = execute({
            schema,
            document: parse(`
                query {
                    primaryTypes {
                        value
                    }
                }
            `),
        });

        expect(result).toEqual({
            data: {
                primaryTypes: [
                    {
                        value: 10,
                    },
                    {
                        value: 20,
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
                    primaryTypes {
                        name
                        other {
                            name
                            other {
                                name
                                other {
                                    name
                                    value
                                }
                            }
                        }
                    }
                }
            `),
        });

        expect(result).toEqual({
            data: {
                primaryTypes: [
                    {
                        name: 'test1',
                        other: {
                            name: 'test2',
                            other: {
                                name: 'test1',
                                other: {
                                    name: 'test2',
                                    value: 20,
                                },
                            },
                        },
                    },
                    {
                        name: 'test2',
                        other: {
                            name: 'test1',
                            other: {
                                name: 'test2',
                                other: {
                                    name: 'test1',
                                    value: 10,
                                },
                            },
                        },
                    },
                ],
            },
        });
    });
});
