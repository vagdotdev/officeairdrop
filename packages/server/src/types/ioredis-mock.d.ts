/**
 * `ioredis-mock` ships no type declarations. We only use it in tests, where an
 * in-memory Redis double is cast to the real `Redis` type, so an opaque module
 * declaration is sufficient.
 */
declare module 'ioredis-mock' {
  const RedisMock: new (...args: unknown[]) => unknown;
  export default RedisMock;
}
