# macOS installed-runtime verification

These verification tools exercise the signed release in an isolated,
temporary profile. They contain synthetic sessions and providers, never an owner
profile or credentials. Close other AiRC instances before running them.

The root `LICENSE` and `LICENSES.md` govern this verification code, including
the retained licenses of inherited components. This folder does not publish
the application implementation or change its licensing. Playwright is installed
separately at test time under its own license.

The workflow installs the exact release archive into `/Applications/AiRC.app`
and checks 4,000-message progressive replay, bounded memory, draft preservation,
single-send persistence, native terminal output/exit, workflow recovery,
automation survival, updater metadata and rapid-crash limits.

The harness originated from application source
`1f9db05ee66d73f8b353f627639a6b620b5289cf`. This verification copy adds a
controlled POSIX shell/native terminal check and waits for recovery's transient
connection state to settle within the existing readiness deadline. It also
records the first visual frame before testing input. Original assertions remain.

Its adjacent `package.json` is generated in the temporary runner directory from
the release manifest. The runtime uses pinned Playwright 1.58.2 for CDP;
no additional browser download is required.
