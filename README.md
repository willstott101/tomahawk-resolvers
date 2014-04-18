# Tomahawk Resolvers

Supported resolvers are distributed and updated automatically through Tomahawk's Settings dialog.
To manually install a resolver either 
* clone this repo, or
* download the .zip (see .zip button at the top of the repo page at https://github.com/tomahawk-player/tomahawk-resolvers), or 
* download all the files within the individual resolver folder you are installing.

After you have the files locally, open Tomahawk's preferences and from the "Services" tab click "Install from File" and select the .axe or .js file for the resolver you are installing.

Since March 2013 Tomahawk resolvers have switched to a new directory structure for easy packaging. Ideally, you should download nightly .axe files, if available.

For developer documentation, see [HACKING.md](HACKING.md).

## Capabilities

Not all resolvers feature the same capabilities, this is either due to the lacking capabilities of the service they connect to or that the capability is not yet implemented.
Some of the features need authentication (e.g. being a premium subscriber to this service), some can be used without any subscription or authentication at all.

**Legend:**
* ✔ - Supports without authentication
* :lock: - Authentication required
* ? - Unknown
* ✘ - No support for this capability

**Notes:**
* Some services can search without being authenticated but only resolve after authentication. At the moment, we do not support this in Tomahawk but this may change in future.

| *Resolver* | Resolving | Search | Open Artist URL | Open Album URL | Open Playlist URL | Open Track URL | Collection |
|------------|-----------|--------|-----------------|----------------|-------------------|----------------|------------|
| 4shared    | ?         | ?      | ?               | ?              | ?                 | ?              | ?          |
| 8tracks    | ?         | ?      | ?               | ?              | ?                 | ?              | ?          |
| ampache    | :lock:    | :lock: | ✘               | ✘              | ✘                 | ✘              | ✔          |
| beatsmusic | :lock:    | ✔      | ✔               | ✔              | :lock:            | ✔              | ✘          |
