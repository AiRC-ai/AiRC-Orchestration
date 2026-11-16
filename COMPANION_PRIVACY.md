# AiRC Privacy Policy

Updated November 16, 2026. This policy covers AiRC 7 for iPhone and iPad.
Version 7.1 adds standalone Local chat alongside the Remote companion for AiRC
Orchestration. The [earlier application
policy](https://gist.github.com/RCFilm/50f625771a775b711c715baadbe4539c)
applies to the older standalone 2.1 application, including its Mac version.

## Local Chat

Chat works without an AiRC desktop or developer-managed account. You choose
Apple Intelligence, a connected provider account, a configured model service,
or an available model on your paired computer.

On-device Apple Intelligence processes requests on your device. When supported,
Apple cloud processing uses Private Cloud Compute after you allow cloud use.
You can turn that choice off in Chat settings. Availability depends on the
device, system, language, region, and Apple Intelligence settings. Apple's
[Apple Intelligence privacy information](https://www.apple.com/legal/privacy/data/en/intelligence-engine/)
explains its on-device and cloud processing practices.

For a cloud or configured model service, the app sends the conversation needed
for your reply and the supported attachments you choose directly to that
service. The destination also receives ordinary connection information, such
as your IP address. The service's account, retention, and privacy terms apply.
Chat does not route these requests through an AiRC-operated collection server.

Continue with ChatGPT opens OpenAI's sign-in service and uses your personal
account's granted access. OpenAI handles the sign-in credentials; AiRC keeps
the resulting connection tokens in Keychain. OpenAI API credentials are a
separate optional connection. Review [OpenAI's privacy policy](https://openai.com/policies/privacy-policy/)
and your account's data controls. Other configured services, including DeepSeek
and Ollama endpoints, have their own policies and settings. A custom endpoint
is controlled by its operator; verify the destination before connecting.

Selecting a paired computer's model in Chat sends the request to that computer,
which invokes its configured provider. Provider credentials remain on the
computer. This connection does not enable desktop tools or create a Remote
conversation. Chat history remains local to the phone or tablet.

Local opens by default. If you have saved a remote computer, AiRC can connect
to it while you use Local. You can turn automatic connection off and choose
which mode opens in Settings. Changing modes does not send a draft or start a
model request. The operating system may suspend connections when the app itself
is in the background.

## Remote: Your Host And Your Providers

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

## What AiRC Keeps On Your Device

AiRC stores local Chat conversations and drafts, provider-connection settings,
saved host connections, pairing credentials, and preferences so you can continue
working. Chat history is encrypted at rest; sensitive local records
and temporary content use encryption and Apple Keychain-backed protection.
Downloaded or previewed content may be held temporarily on the device. Files
you explicitly save or share remain at the destination you select and are
subject to that destination's storage and backup settings.

AiRC has no advertising, tracking, or developer analytics SDK and
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

Dictation uses Apple's speech services after the corresponding permission.
Processing depends on system support and your Apple settings. Read aloud uses
system speech synthesis. AiRC does not run a developer-operated audio collection
service. Selected photos, extracted document content, and dictated text may be
sent with a request to the model service you choose.

The optional live view displays images from the selected task's Computer Use,
in-app browser, or Playwright activity on your host. These images can contain
information visible in the host application or website. The companion receives
them from your host; this view does not transmit them to the developer.

Host-provided interactive apps may load declared external HTTPS resources
under their enforced content policy. Those destinations can receive ordinary
web requests and information you choose to provide. Review an app's permissions
and the destination's policy before using it. External support or download
links open the service you select, whose privacy policy also applies.

## Inline Media And Document Previews

When Find public photos is enabled and you ask for pictures, the selected model
helps identify concise photo-search subjects from the relevant conversation.
AiRC sends those subjects to Wikimedia Commons and downloads image data for
inline display with credits and source links. It does not send your complete
conversation, attachments, account credentials, or ChatGPT connection tokens to
Wikimedia. Wikimedia receives ordinary network information such as your IP
address. Its [privacy policy](https://foundation.wikimedia.org/wiki/Policy:Privacy_policy)
applies. You can disable this feature in Settings under Photos & files.

Downloaded public pictures and their source credits are saved with the local
conversation so that they remain available when you reopen it. Saving or
sharing a picture creates a copy only at your chosen destination.

Messages can contain images, video, audio and document links. Displaying linked
media sends a normal web request to its source, which can receive your IP address
and standard browser information. Supported public YouTube, Facebook, Vimeo and
Spotify links can display an inline player. These players use separate temporary
web sessions and have no access to AiRC’s native controls, saved host credentials,
provider keys, or ChatGPT connection tokens. The media service’s privacy policy
and access restrictions apply. Opening the original link uses the destination
service you choose.

When you tap Preview and save, AiRC downloads the supported file directly from
its source into a temporary native preview. Save to Files, Save to Photos and
Share require your action. AiRC does not upload these preview downloads to a
developer-operated server.

## Your Choices

You can delete local Chat conversations, remove provider connections, change
your default model and mode, and turn Apple cloud use off in Chat settings.
Removing a local conversation or signing out does not delete copies retained
by a provider under its own policy; use that provider's account controls for
those copies. Removing the app does not revoke a remote provider's account.

You can manage or remove saved hosts in Remotes & Connections, revoke a paired
device or disable companion access on the host, change system permissions,
and choose which files to send or export. Manage stored conversation history,
provider accounts, extensions, and any optional desktop telemetry through the
host. Removing a connection from the phone does not delete the host's history
or copies you previously exported or backed up.

For privacy questions, use [Support](SUPPORT.md). Do not include private chat
content, credentials, access tokens, or personal files in a public issue.
