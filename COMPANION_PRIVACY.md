# AiRC Companion Privacy Policy

Updated November 12, 2026. This policy covers AiRC 7.0 and later for iPhone and
iPad, the remote companion for AiRC Orchestration. The [earlier application
policy](https://gist.github.com/RCFilm/50f625771a775b711c715baadbe4539c)
applies to the older standalone 2.1 application, including its Mac version.

## Your Host And Your Providers

The companion connects to the AiRC Orchestration host you choose. It sends your
messages, selected attachments, and requested actions to that host and receives
conversation history, results, usage information, and status from it. Pairing
uses a QR code and a host certificate fingerprint that you verify. Connections
to the paired host use encrypted transport and certificate verification.

Your host stores conversations and runs model requests, tools, automations,
and other actions. Depending on your configuration, the host sends information
to the model providers, extensions, websites, or other services you choose.
Those services have their own privacy policies. Provider credentials remain on
the host; the companion does not need a developer-managed AiRC account or a
shared developer API key. Check the host's permissions and settings before
allowing access to private projects or services.

## What The Companion Keeps On Your Device

The companion stores saved host connections, pairing credentials, preferences,
and drafts so you can reconnect and continue working. Sensitive local records
and temporary content use encryption and Apple Keychain-backed protection.
Downloaded or previewed content may be held temporarily on the device. Files
you explicitly save or share remain at the destination you select and are
subject to that destination's storage and backup settings.

The companion has no advertising, tracking, or developer analytics SDK and
does not send conversation content to an AiRC-operated collection server.
This release has no configured push relay and does not register for remote
push notifications. Local notifications and Live Activities can show task
information when enabled. Device diagnostics or other Apple system services
are governed by your Apple settings and Apple's policies.

## Photos, Files, And Live Views

Camera access is used when you choose to scan a pairing code or attach a
photo. Photo and document pickers let you choose the items to send. Saving to
Photos requires the corresponding permission. Download, Save to Files, and
Share run only when you choose them.

The optional live view displays images from the selected task's Computer Use,
in-app browser, or Playwright activity on your host. These images can contain
information visible in the host application or website. The companion receives
them from your host; this view does not transmit them to the developer.

Host-provided interactive apps may load declared external HTTPS resources
under their enforced content policy. Those destinations can receive ordinary
web requests and information you choose to provide. Review an app's permissions
and the destination's policy before using it. External support or download
links open the service you select, whose privacy policy also applies.

## Your Choices

You can manage or remove saved hosts in Remotes & Connections, revoke a paired
device or disable companion access on the host, change system permissions,
and choose which files to send or export. Manage stored conversation history,
provider accounts, extensions, and any optional desktop telemetry through the
host. Removing a connection from the phone does not delete the host's history
or copies you previously exported or backed up.

For privacy questions, use [Support](SUPPORT.md). Do not include private chat
content, credentials, access tokens, or personal files in a public issue.
