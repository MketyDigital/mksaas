'use strict';

/* eslint @typescript-eslint/no-require-imports: off */
const assert = require('node:assert/strict');
const braces = process.env.BRACES_IMPL ? require(process.env.BRACES_IMPL) : require('./braces');

const makeNestedPattern = (depth) => `${'{'.repeat(depth)}a,b${'}'.repeat(depth)}`;
const makeNestedAst = (depth) => {
  let ast = { type: 'text', value: 'a' };
  for (let i = 0; i < depth; i++) ast = { type: 'brace', nodes: [ast] };
  return { type: 'root', nodes: [ast] };
};

assert.throws(
  () => braces.parse(makeNestedPattern(101)),
  (error) => error instanceof SyntaxError && /exceeds max depth/.test(error.message),
  'the parser should reject nesting beyond its safe default depth',
);

assert.doesNotThrow(() => braces.parse(makeNestedPattern(100)));
assert.throws(() => braces.compile(makeNestedAst(101)), /exceeds max depth/);
assert.throws(() => braces.expand(makeNestedAst(101)), /exceeds max depth/);
assert.throws(() => braces.stringify(makeNestedAst(101)), /exceeds max depth/);
assert.equal(braces.stringify(braces.parse('{{a}}'), { escapeInvalid: true }), '{{a}}');
assert.equal(braces.compile("'abc"), 'abc');
assert.deepEqual(braces.expand("'a{b,c"), ['a{b,c']);

console.log('braces nesting-depth regression checks passed');
