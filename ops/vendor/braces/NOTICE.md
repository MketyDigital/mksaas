# Vendored braces security fix

This local fork is based on the MIT-licensed `micromatch/braces` 3.0.3 source and the depth-limit remediation proposed in upstream pull request [#72](https://github.com/micromatch/braces/pull/72), commit `28d440b5dd449dbf1fe6f3506cf94ecca4d02660`.

The upstream patch is vendored locally as version `3.0.4-mkety.1` until an upstream release is available. The unmatched-quote parsing changes from the pull request are intentionally excluded to keep this patch limited to nesting-depth protection. See `LICENSE` for the MIT license.
