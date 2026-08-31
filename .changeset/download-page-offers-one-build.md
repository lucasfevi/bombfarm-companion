---
"@bombfarm/web": minor
---

Make the download page offer one build instead of a menu of channels.

The channel chip beside the download button, the Stable and Beta cards, and the channel word in
the file line are all gone. What is left says what a visitor actually needs: the installer's name,
its size, that it is for Windows 10/11, and that it updates itself. The install and update counts
stay where they were.

The page now resolves the stable build and nothing else. It used to fall back to the newest beta
when no stable release existed, which was the right behaviour while none did — but that fallback
was only honest because the chip and the cards named the channel it had landed on. With the labels
gone there is no way to say "this is a beta", so serving one would mean handing someone a
prerelease under a page that cannot mention it. Where a beta would once have been offered, the
button now points at the releases page instead, which is the same thing it has always done when
GitHub cannot be reached: never a wrong build, never a 404.

Recognising the stable installer stays a positive match — a version digit immediately after the
product name, which is what electron-builder produces for the one flavor it does not put a channel
word into. Matching it as "not one of the other channels" would adopt a channel added later as
stable, on a page with no way to tell anyone.
