import { readFileSync } from 'fs';
import { join } from 'path';

import { execute, GraphQLSchema, parse } from 'graphql';
import { createSchema } from '../../src';

describe('GlobalObjectIdentification', () => {
    const schema = createSchema((file) => readFileSync(join(__dirname, 'documents', file)).toString()) as GraphQLSchema;

    describe('Node interface', () => {
        it('Implements the spec', () => {
            // See https://graphql.org/learn/global-object-identification/#introspection
            const result = execute({
                schema,
                document: parse(`
                    query {
                        __type(name: "Node") {
                            name
                            kind
                            fields {
                                name
                                type {
                                    kind
                                    ofType {
                                        name
                                        kind
                                    }
                                }
                            }
                        }
                    }
                `),
            });

            expect(result).toEqual({
                data: {
                    __type: {
                        name: 'Node',
                        kind: 'INTERFACE',
                        fields: [
                            {
                                name: 'id',
                                type: {
                                    kind: 'NON_NULL',
                                    ofType: {
                                        name: 'ID',
                                        kind: 'SCALAR',
                                    },
                                },
                            },
                        ],
                    },
                },
            });
        });

        it('auto implements for Primary types only', () => {
            const result = execute({
                schema,
                document: parse(`
                    query {
                        __type(name: "Node") {
                            possibleTypes {
                                name
                                kind
                            }
                        }
                    }
                `),
            });

            expect(result).toEqual({
                data: {
                    __type: {
                        possibleTypes: [
                            {
                                name: 'Query',
                                kind: 'OBJECT',
                            },
                            {
                                name: 'PrimaryType',
                                kind: 'OBJECT',
                            },
                            {
                                name: 'SecondPrimaryType',
                                kind: 'OBJECT',
                            },
                        ],
                    },
                },
            });
        });
    });

    describe('Query.node', () => {
        it('Implements the spec', () => {
            // See https://graphql.org/learn/global-object-identification/#introspection-1
            const result = execute({
                schema,
                document: parse(`
                    query {
                        __schema {
                            queryType {
                                fields {
                                    name
                                    type {
                                        name
                                        kind
                                    }
                                    args {
                                        name
                                            type {
                                            kind
                                            ofType {
                                                name
                                                kind
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                `),
            });

            expect(result).toEqual({
                data: {
                    __schema: {
                        queryType: {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                            fields: expect.arrayContaining([
                                {
                                    name: 'node',
                                    type: {
                                        name: 'Node',
                                        kind: 'INTERFACE',
                                    },
                                    args: [
                                        {
                                            name: 'id',
                                            type: {
                                                kind: 'NON_NULL',
                                                ofType: {
                                                    name: 'ID',
                                                    kind: 'SCALAR',
                                                },
                                            },
                                        },
                                    ],
                                },
                            ]),
                        },
                    },
                },
            });
        });

        describe('It returns null for invalid JSON', () => {
            const result = execute({
                schema,
                document: parse(`
                    query {
                        node(id: "A") {
                            __typename
                            id
                        }
                    }
                `),
            });

            expect(result).toEqual({
                data: {
                    node: null,
                },
            });
        });

        describe('It returns null for invalid key', () => {
            const result = execute({
                schema,
                document: parse(`
                    query {
                        node(id: "{}") {
                            __typename
                            id
                        }
                    }
                `),
            });

            expect(result).toEqual({
                data: {
                    node: null,
                },
            });
        });

        describe('It returns the node for the primary key', () => {
            const result = execute({
                schema,
                document: parse(`
                    query($id: ID!) {
                        node(id: $id) {
                            __typename
                            id
                            ... on PrimaryType {
                                value
                            }
                        }
                    }
                `),
                variableValues: {
                    id: '{"__typename":"PrimaryType","name":"test1"}',
                },
            });

            expect(result).toEqual({
                data: {
                    node: {
                        __typename: 'PrimaryType',
                        id: '{"__typename":"PrimaryType","name":"test1"}',
                        value: 10,
                    },
                },
            });
        });

        describe('It returns the node for the secondary key', () => {
            const result = execute({
                schema,
                document: parse(`
                    query($id: ID!) {
                        node(id: $id) {
                            __typename
                            id
                            ... on PrimaryType {
                                value
                            }
                        }
                    }
                `),
                variableValues: {
                    id: '{"__typename":"PrimaryType","name2":"test1"}',
                },
            });

            expect(result).toEqual({
                data: {
                    node: {
                        __typename: 'PrimaryType',
                        id: '{"__typename":"PrimaryType","name":"test1"}',
                        value: 10,
                    },
                },
            });
        });
    });
});
