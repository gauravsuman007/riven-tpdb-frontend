import { graphql } from "msw";

/**
 * All operations (queries, mutations, subscriptions) go through this single
 * endpoint — see `GRAPHQL_PROXY_URL` in `src/lib/graphql-client.ts`. Every
 * query/mutation in the app is a named operation (e.g. `query TrendingAnilist`),
 * so handlers are registered per operation name via this link rather than by URL.
 */
export const gqlEndpoint = graphql.link("/graphql");

/**
 * No handlers registered globally — each story/page opts into the specific
 * operations it needs via a `beforeEach({ msw }) { msw.use(...) }` hook on
 * the `<Story>`, built from `gqlEndpoint.query(...)` / `gqlEndpoint.mutation(...)`.
 */
export const graphqlHandlers = [];
