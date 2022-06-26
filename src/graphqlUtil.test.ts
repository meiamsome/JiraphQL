import {
    GraphQLFieldConfig,
    GraphQLInputObjectType,
    GraphQLList,
    GraphQLNonNull,
    GraphQLObjectType,
} from 'graphql';
import { mapFieldTypes, mapType } from './graphqlUtil';

describe('mapType', () => {
    const type = new GraphQLObjectType({
        name: 'test',
        fields: {},
    });

    const newType = new GraphQLObjectType({
        name: 'test',
        fields: {},
    });

    it('throws in an invalid situation', () => {
        expect(() => mapType(type, []))
            .toThrow('Failed to find mapped type by name: \'test\'');
    });

    it('maps an object type directly', () => {
        expect(mapType(type, [newType]))
            .toBe(newType);
    });

    it('maps lists', () => {
        expect(mapType(new GraphQLList(type), [newType]))
            .toEqual(new GraphQLList(newType));
    });

    it('maps non null', () => {
        expect(mapType(new GraphQLNonNull(type), [newType]))
            .toEqual(new GraphQLNonNull(newType));
    });

    it('maps multiple layers of wrapping types', () => {
        expect(mapType(
            new GraphQLNonNull(new GraphQLList(new GraphQLList(new GraphQLNonNull(type)))),
            [newType],
        ))
            .toEqual(
                new GraphQLNonNull(new GraphQLList(new GraphQLList(new GraphQLNonNull(newType)))),
            );
    });
});

describe('mapFieldTypes', () => {
    const typeA = new GraphQLObjectType({
        name: 'typeA',
        fields: {},
    });
    const typeB = new GraphQLInputObjectType({
        name: 'typeB',
        fields: {},
    });

    it('errors if an input type cannot be mapped to an input type', () => {
        const fieldConfig: GraphQLFieldConfig<unknown, unknown> = {
            args: {
                argumentField: {
                    type: new GraphQLInputObjectType({
                        name: 'typeA',
                        fields: {},
                    }),
                },
            },
            type: new GraphQLObjectType({
                name: 'typeA',
                fields: {},
            }),
        };

        expect(() => mapFieldTypes(fieldConfig, [typeA]))
            .toThrow('Failed to map input type correctly');
    });

    it('errors if the output type cannot be mapped to an output type', () => {
        const fieldConfig: GraphQLFieldConfig<unknown, unknown> = {
            type: new GraphQLObjectType({
                name: 'typeB',
                fields: {},
            }),
        };

        expect(() => mapFieldTypes(fieldConfig, [typeB]))
            .toThrow('Failed to map output type correctly');
    });

    it('maps types correctly', () => {
        const fieldConfig: GraphQLFieldConfig<unknown, unknown> = {
            args: {
                argName: {
                    type: new GraphQLInputObjectType({
                        name: 'typeB',
                        fields: {},
                    }),
                },
            },
            type: new GraphQLObjectType({
                name: 'typeA',
                fields: {},
            }),
        };

        expect(mapFieldTypes(fieldConfig, [typeA, typeB]))
            .toEqual({
                args: {
                    argName: {
                        type: typeB,
                    },
                },
                type: typeA,
            });
    });

    it('maps wrapped types correctly', () => {
        const fieldConfig: GraphQLFieldConfig<unknown, unknown> = {
            args: {
                argName: {
                    type: new GraphQLNonNull(new GraphQLList(new GraphQLInputObjectType({
                        name: 'typeB',
                        fields: {},
                    }))),
                },
                argName2: {
                    type: new GraphQLList(new GraphQLNonNull(new GraphQLInputObjectType({
                        name: 'typeB',
                        fields: {},
                    }))),
                },
            },
            type: new GraphQLNonNull(new GraphQLList(new GraphQLObjectType({
                name: 'typeA',
                fields: {},
            }))),
        };

        expect(mapFieldTypes(fieldConfig, [typeA, typeB]))
            .toEqual({
                args: {
                    argName: {
                        type: new GraphQLNonNull(new GraphQLList(typeB)),
                    },
                    argName2: {
                        type: new GraphQLList(new GraphQLNonNull(typeB)),
                    },
                },
                type: new GraphQLNonNull(new GraphQLList(typeA)),
            });
    });
});
