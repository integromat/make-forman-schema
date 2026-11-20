# Function selector compatibility (AX-63)

`function` uses select option resolution and nested validation, preserves number/string IDs,
and rejects non-scalar references even when dynamic values are allowed. Its JSON Schema
retains picker and dependent-input RPC metadata. It has no implicit API endpoint and does
not reject an option because its Function is Off. Existing select rules determine whether
an unavailable remote option is an error or a warning.

## Releases and consumers

The feature branch starts at freshly fetched `origin/main`
`28702a75b18aa9417edecb9145b1566377e4e5c3`. Package versions are unchanged until release.

| Consumer | Current schema major | Required action |
| --- | --- | --- |
| make-maiak | 1.x | Install the published compatible 1.x release and updated maia-utils. |
| make-mcp-server-host | 2.x | Install the published compatible 2.x release and updated maia-utils. |
| mono / maia-utils | 1.x development dependency; peers 1.x and 2.x | Raise the development pin and peer minimums to the actual compatible releases. |

Release 2.x through the normal reviewed main-branch process. Do not guess consumer pins.
The existing publish workflow uses npm's default `latest` tag; **do not use that workflow
unchanged for a 1.x maintenance release**.

## Tested 1.x backport

`ax-63-schema-1.patch` applies to a clean export of tag `v1.19.0`, the current published
1.x release. It includes the additive source changes and regression tests. It does not
backport the 2.x validation-result keys, field-edge exports, or unrelated schema changes.
Static Function option schemas retain the 1.x converter's number/string union; 2.x can
narrow the type from its static options. Both preserve the original scalar values.

1. Export the verified `v1.19.0` source into an isolated release directory and apply the patch
   with `git apply --check` followed by `git apply`.
2. Run a frozen install, `npm run lint`, `npm test`, and `npm run build` on supported Node
   versions. Verify the result-shape regression alongside the Function tests.
3. Have the release owner choose an unused 1.x version using the release process, update
   its package metadata and lockfile, and review the packed artifact with `npm pack --dry-run`.
4. Publish the reviewed artifact from the approved release environment with an explicit
   maintenance tag: `npm publish --tag legacy-v1 --provenance --access public`.
5. Verify the published artifact and that `npm view @makehq/forman-schema dist-tags --json`
   still assigns `latest` to the current 2.x release. Never relabel a 2.x build as 1.x.

Local validation on Node 24.22.3: 2.x passes 619 tests; the 1.x export passes 499 tests,
including unchanged result shape. Both pass type checking and ESM/CJS/declaration builds.
The 1.x backport was also verified on Node 20.20.2 with its own frozen `npm ci` install:
all 499 tests, type checking, and both module/declaration builds pass. Release CI must
still run its supported runtime matrix against the reviewed release artifact.

## Activation gate

Deploy the compatible schema and utility releases to MAIA and the MCP host before
activating the native app's `type: function` manifest. Verify schema presentation,
picker lookup, generated input validation, mapping, and existing saved blueprints
through the real module-configuration tools. Blueprint runtime and Forman asset gates
also remain required. Roll back the manifest to `select` first; retain additive support.
