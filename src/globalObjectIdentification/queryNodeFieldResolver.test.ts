import {
    GraphQLID,
    GraphQLInterfaceType,
    GraphQLNonNull,
} from 'graphql';
import { createQueryNodeFieldAdder, createQueryNodeFieldResolver } from './queryNodeFieldResolver';

describe('createQueryNodeFieldResolver', () => {
    const fetcher = jest.fn();
    const keyFn = jest.fn();
    const resolver = createQueryNodeFieldResolver(
        fetcher,
        keyFn,
    );

    it('returns null for invalid JSON', () => {
        expect(resolver({}, { id: 'A' }))
            .toBe(null);
    });

    it('returns null for JSON that isn\'t an object', () => {
        expect(resolver({}, { id: '[]' }))
            .toBe(null);
    });

    it('returns null if the keyFn returns null', () => {
        keyFn.mockReturnValue(null);

        expect(resolver({}, { id: '{"__typename":"TestType"}' }))
            .toBe(null);

        expect(keyFn)
            .toHaveBeenCalledWith(
                {
                    __typename: 'TestType',
                },
                fetcher,
            );
    });

    it('returns key if the keyFn returns a path synchronously', () => {
        keyFn.mockReturnValue('path/to/file.json');

        expect(resolver({}, { id: '{"__typename":"TestType"}' }))
            .toEqual({
                __typename: 'TestType',
            });

        expect(keyFn)
            .toHaveBeenCalledWith(
                {
                    __typename: 'TestType',
                },
                fetcher,
            );
    });

    it('returns key if the keyFn returns a path asynchronously', async () => {
        keyFn.mockResolvedValue('path/to/file.json');

        await expect(resolver({}, { id: '{"__typename":"TestType"}' }))
            .resolves
            .toEqual({
                __typename: 'TestType',
            });

        expect(keyFn)
            .toHaveBeenCalledWith(
                {
                    __typename: 'TestType',
                },
                fetcher,
            );
    });
});

describe('createQueryNodeFieldAdder', () => {
    const fetcher = jest.fn();
    const keyFn = jest.fn();
    const interfaceType = new GraphQLInterfaceType({
        name: 'Node',
        fields: {},
    });

    const adder = createQueryNodeFieldAdder(
        fetcher,
        keyFn,
        interfaceType,
    );

    it('errors if the node field exists', () => {
        expect(() => adder({
            node: {
                type: GraphQLID,
            },
        })).toThrow('Type already has a node field when trying to create Query.node');
    });

    it('adds an id field with resolver', () => {
        expect(adder({
            existingField: {
                type: GraphQLID,
            },
        })).toEqual({
            existingField: {
                type: GraphQLID,
            },
            node: {
                args: {
                    id: {
                        type: new GraphQLNonNull(GraphQLID),
                    },
                },
                type: interfaceType,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                resolve: expect.any(Function),
            },
        });
    });
});
