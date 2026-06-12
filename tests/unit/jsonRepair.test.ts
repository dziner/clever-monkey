import { describe, it, expect } from 'vitest';
import { repairJSON, cleanAndParseJSON } from '../../utils/jsonRepair';

describe('repairJSON', () => {
    it('strips trailing commas before } and ]', () => {
        expect(repairJSON('{"a":1,}')).toBe('{"a":1}');
        expect(repairJSON('[1,2,3,]')).toBe('[1,2,3]');
    });

    it('strips // line comments and /* block comments */', () => {
        expect(repairJSON('{"a":1} // trailing')).toBe('{"a":1} ');
        expect(repairJSON('{/* hi */"a":1}')).toBe('{"a":1}');
    });

    it('leaves valid JSON untouched', () => {
        expect(repairJSON('{"a":[1,2]}')).toBe('{"a":[1,2]}');
    });
});

describe('cleanAndParseJSON', () => {
    it('parses a plain JSON object', () => {
        expect(cleanAndParseJSON('{"a":1}')).toEqual({ a: 1 });
    });

    it('parses a plain JSON array', () => {
        expect(cleanAndParseJSON('[1,2,3]')).toEqual([1, 2, 3]);
    });

    it('strips Markdown fences', () => {
        expect(cleanAndParseJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
        expect(cleanAndParseJSON('```\n[1,2]\n```')).toEqual([1, 2]);
    });

    it('extracts JSON from prose-wrapped output', () => {
        expect(cleanAndParseJSON('Sure! Here is the JSON: {"a":1} — let me know if you need more.'))
            .toEqual({ a: 1 });
    });

    it('repairs trailing commas inside the extracted region', () => {
        expect(cleanAndParseJSON('Output: {"a":1,"b":2,}')).toEqual({ a: 1, b: 2 });
    });

    it('repairs JS-style comments inside JSON', () => {
        expect(cleanAndParseJSON('{"a":1 /* comment */, "b":2}')).toEqual({ a: 1, b: 2 });
    });

    it('throws when prose contains two unrelated JSON objects (ambiguous)', () => {
        // The extractor takes from first { to last }, so the slice
        // becomes `{"k":"v"} outro {"k":"v2"}` — itself unparseable.
        // Better to throw than silently pick one (the model output is
        // malformed and the caller should regenerate).
        expect(() => cleanAndParseJSON('Intro {"k":"v"} outro {"k":"v2"} done.')).toThrow();
    });

    it('throws when there is no recoverable JSON', () => {
        expect(() => cleanAndParseJSON('no json here')).toThrow();
    });
});
