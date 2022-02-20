import {
    isObject,
    isPromise,
    isStringMap,
    MaybePromise,
    maybeThen,
} from './tsutil';

describe('tsutil', () => {
    describe('isObject', () => {
        it.each([
            undefined,
            null,
            '',
            0,
            Symbol('test'),
        ])('returns false for %p', (value) => {
            expect(isObject(value)).toBe(false);
        });

        it.each([
            {},
            {
                test: 1,
            },
            new Promise(() => {}),
        ])('returns true for %p', (value) => {
            expect(isObject(value)).toBe(true);
        });
    });

    describe('isStringMap', () => {
        it.each([
            undefined,
            null,
            '',
            0,
            Symbol('test'),
            {
                test: 1,
            },
        ])('returns false for %p', (value) => {
            expect(isStringMap(value)).toBe(false);
        });

        it.each([
            {},
            {
                test: 'test',
            },
        ])('returns true for %p', (value) => {
            expect(isStringMap(value)).toBe(true);
        });
    });

    describe('isPromise', () => {
        it.each([
            undefined,
            null,
            '',
            0,
            Symbol('test'),
            {},
            {
                test: 1,
            },
        ])('returns false for %p', (value) => {
            expect(isPromise(value)).toBe(false);
        });

        it.each([
            new Promise(() => {}),
        ])('returns true for %p', (value) => {
            expect(isPromise(value)).toBe(true);
        });
    });

    describe('maybeThen', () => {
        describe('for a non-promise', () => {
            const value = Symbol('value');
            const returnValue = Symbol('returnValue');

            it('executes immediately', () => {
                const mock = jest.fn().mockReturnValue(returnValue);

                expect(maybeThen(value, mock)).toBe(returnValue);
                expect(mock).toBeCalledWith(value);
            });
        });

        describe('for a promise', () => {
            const value = Symbol('value');
            const returnValue = Symbol('returnValue');
            let promise: Promise<symbol>;
            let resolve: (value: symbol) => void;
            beforeEach(() => {
                promise = new Promise((_resolve) => {
                    resolve = _resolve;
                });
            });

            it('executes after promise resolution', async () => {
                const mock = jest.fn().mockReturnValue(returnValue);

                const returnedPromise: MaybePromise<unknown> = maybeThen(promise, mock);
                expect(returnedPromise).toBeInstanceOf(Promise);
                expect(mock).not.toHaveBeenCalled();

                resolve(value);

                await expect(returnedPromise).resolves.toBe(returnValue);
                expect(mock).toBeCalledWith(value);
            });
        });
    });
});
