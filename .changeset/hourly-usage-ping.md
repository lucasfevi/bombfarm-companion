---
"@bombfarm/desktop": minor
"@bombfarm/contracts": minor
"@bombfarm/web": minor
---

The installed app now tells our server once an hour that it is running, so we can count how many people use it. While the new Settings switch "Include my account in the usage count" is on (the default), the message carries a random code for this installation, the game account id and the player name. Turned off, it carries only the app version and build, and the installation's code is deleted from this machine. Development builds never send it.

The website gains a privacy policy at /privacy, linked from the site footer and from the desktop app's Settings, describing exactly what the app sends, how long it is kept, who handles it and how to have it deleted.
