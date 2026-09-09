# TruthShop demo application

TruthShop is a polished small storefront that exists specifically to exercise the real ReleaseTruth capture and diff pipeline. One codebase exposes two runtime variants through `TRUTHSHOP_VARIANT=good|regression`, allowing both releases to build from the same repository while producing deliberate behavior changes.

| Surface | `good` | `regression` |
| --- | --- | --- |
| API validation | `POST /api/orders` invalid quantity → 400 `{error}` | 422 `{message,field}` |
| Accessibility | checkout control is a native keyboard-focusable `<button>` | clickable `<div>` without keyboard semantics |
| UI copy | “Save Profile” | “Save” |
| Performance | search adds ~20 ms app delay | search adds ~220 ms app delay |
| Browser safety | cancelling checkout asks for confirmation | confirmation removed |
| Events | `payment.completed` then `invoice.generated` | order reversed |
| CLI | `receipt` exits 0 | emits same output but exits 1 |
| Cookie | session SameSite=Lax | SameSite=None + Secure |
| Layout | checkout form before summary | summary before form |

The changes are implemented in the application, not hardcoded in ReleaseTruth fixtures. Demo automation launches both variants on separate ports and points the same journeys/scenarios at each one.
