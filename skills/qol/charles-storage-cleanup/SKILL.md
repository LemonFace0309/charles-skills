---
name: charles-storage-cleanup
description: "Finds what is filling a Mac's disk and cleans only what is safe: measures usage, explains recent growth, finds rarely used apps and overlooked caches, runtimes, simulators and build output, and deletes only what the request authorizes while protecting active work. Use when the Mac is out of space or the disk is full, or someone asks what is taking up storage or what is safe to delete."
compatibility: "macOS. Python 3 (standard library only) for scripts/inventory.py. Uses du, df, ps, lsof and mdls, plus the native tools of whatever it cleans (xcrun simctl, avdmanager, npm, conda and the like)."
---

# Storage cleanup

Free real space on the Mac's data volume without losing anything someone still needs. The result is the change in free bytes on that volume, measured before and after. The size of what was deleted isn't the result: APFS clones and snapshots share blocks, so deleting a 40 GB folder can free almost nothing.

## What the request allows

- **"Clean up", "delete", "free up space"** allows deleting what this skill confirms is disposable, without asking again for each item. Why: the person asked for the result, and a question per cache wastes their time.
- **"What's taking space", "report only", "don't delete"** is read-only. Measure and list. Change nothing.
- **Loading this skill allows nothing.** Only the person's own words do.
- **Their choices carry forward** across passes: the items they picked, what they said to keep, age limits ("older than a month") and recent-use conditions. "Look in more places" never cancels an earlier "keep X". Why: a later pass that forgets a keep deletes something they protected.
- **A generic "clear unused files" never covers** source code, uncommitted work, credentials, unique research or media, current releases, or the data inside VMs and containers. Those need the person to name them.

## Always keep

- **Anything in use:** running apps, builds, Git operations, emulators and their data. Never stop a job to make its files deletable. Why: a killed build, or a cache cleared under a running install, breaks someone's work, and the space comes back anyway.
- **Anything uncertain.** An old modification date, an ignored-by-Git status or the lack of an open file handle doesn't prove a thing is disposable on its own. Skip it, say why, and keep cleaning elsewhere.
- **Anything a check couldn't clear.** A probe that failed, timed out or was cut short means "use unknown", not "unused". Missing last-use metadata on an app means unknown too.

## Pick the depth

- **A named target** ("delete the Android emulators", "uninstall DaVinci"): inspect that selection and what depends on it, then finish it. A whole-app uninstall includes the app's own helpers and startup registrations; a cache-only cleanup doesn't.
- **A general cleanup, an unused-app review, "what else?", "look harder":** walk [the discovery checklist](references/discovery.md) through every family: installed software, both Library trees, hidden package stores, runtimes, developer and research output, devices, media and downloads, and storage macOS manages. Never stop at the biggest project or at `~/Library/Caches`. Why: forgotten space is usually spread across many 200 MB to 2 GB stores, not one giant folder.
- **"Why is this folder so big?":** split it into source, generated output, installed environments, Git history and unique assets, and say what the largest pieces actually hold and why they exist before suggesting any removal.

## Run it

1. **Baseline.** Record the local time, the data volume's free bytes (`df -k /System/Volumes/Data`), earlier cleanup receipts, mounts and what's running. Keep the audit private and outside every Git repository, in `~/Library/Logs/storage-cleanup/<date-time>/`. Start with directory sizes that stay on one filesystem (`du -x`), hidden folders and shared app data included, then go deeper only into the large branches, with time limits on each probe.
2. **Cover every family** (broad audits). Mark each one measured, absent, excluded or not fully inspected. Follow configured cache and SDK locations, sibling projects and agent workspaces. After a big removal, look again at the smaller stores it was hiding. A path already deleted, or an old measurement, isn't a new opportunity.
3. **Prove each candidate is disposable and idle.** Walk "Safe to delete?" below. Check processes, their arguments and working folders, open files and running devices, and check again right before deleting.
4. **Delete in measured batches.** Log each exact path, its size, the reason, what rebuilds it and how it was removed. Prefer the tool's own command (`xcrun simctl delete`, `avdmanager delete avd`, `npm cache clean --force`, `conda clean`). For a direct removal, check the exact path, never follow a symlink to its target, and keep any custom data or local patches inside it. Write every target as a literal absolute path: agent safety checks refuse recursive removals built from shell variables, because an empty variable widens the target to its parent. Never clean a whole repository. Finish everything a normal user can delete first, then put whatever needs an administrator into one reviewable batch, and check the result of the job itself, not only that authorization succeeded.
5. **If free space falls again,** compare snapshots and find the writer. Temporary Git packs that keep coming back usually mean a background `git add` is ingesting generated files: follow [the Git procedure](references/macos.md#git-temporary-pack-recurrence). Exclude only confirmed generated material, in that repository's own local exclude file rather than a shared `.gitignore`, back the file up first, and check that tracked files and useful new reports stay visible. Never copy another project's ignore patterns.
6. **Verify and report** (below).

## Safe to delete?

Walk this for every candidate:

```
Is it inside what the person asked to clean, and not something they said to keep?
├── No → leave it. If it's large, list it as an opportunity.
└── Yes → Is anything using it: a process, an open file, a booted device, a running build or install?
    ├── Yes, or a check failed → leave it, and say which check.
    └── No → What is it?
        ├── A cache or download its tool rebuilds (package caches, test browsers, updater archives, build caches)
        │   → delete the stale part with the tool's own clean command or its exact path. Keep what the current
        │     version or a live worker needs.
        ├── Generated project output (dependencies, builds, DerivedData)
        │   → only when its lockfile and build inputs stay and nothing tracked or hand-made is inside. Say it must
        │     be reinstalled before the project runs again.
        ├── Something installed (an app, extension, runtime, simulator, emulator)
        │   → only when the request covers it and its row below passes. Try the vendor's or tool's uninstaller first.
        ├── A duplicate (an installer, an APK or IPA, an archived profile)
        │   → only when a kept copy matches by version or hash and the current release stays.
        └── Something people made (source, media, research, chats, credentials, VM and container disks)
            → never as cleanup. List it as a decision for the person.
```

On top of being idle, each kind needs its evidence:

| Candidate | Evidence it also needs |
| --- | --- |
| Dependencies and builds | It's known generated output; its lockfiles, build inputs or environment metadata stay; no tracked or custom file goes with it |
| Installers, APKs, IPAs | It's obsolete or a duplicate; the current release, the builds reviewers use and any unique analysis evidence stay |
| Emulators and simulators | It's a known throwaway test device with no current task or data on it. Being shut down isn't enough |
| Git temporary packs | Git classifies it as garbage; its size and inode stay the same across separate checks; no live writer or open handle; history stays readable |
| Model and package caches | Its contents download again; logins, installed environments, active models and persistent data stay |
| Rarely used apps and extensions | Bundle or extension identity, measured size, current activity, and a recorded last use or an explicit "unknown"; the person's data and shared components stay |
| Old or duplicate runtimes | Architecture, version, default choice, command links, dependent environments and runtimes embedded in apps are all checked. The pool's size isn't what's removable |
| Downloads, history, logs | The person's own age and recent-use rules, real timestamps where the format has them, and no unique needed content or live writer |

## Two examples

**A cache that rebuilds.** `~/Library/Caches/ms-playwright` is 2.4 GB and holds two Chromium builds. The project's lockfile pins the newer Playwright, and `ps -axo pid=,args=` shows nothing running from that folder. Delete the older build's exact folder, keep the newer one, and log that Playwright downloads the old one again if an old project asks for it. Then run `df` again: the change it shows is the result, not the folder's size on paper.

**An old simulator runtime.** The person asked to remove simulators they haven't used in a month. `xcrun simctl list devices --json` shows four devices on iOS 18.2, none booted, each with a `lastBootedAt` from August, and no project's deployment target or test plan needs 18.2. Delete the four with `xcrun simctl delete <UDID>`, then the runtime with `xcrun simctl runtime delete <id>`. If the runtime only exists under `/System/Library/AssetsV2` with the `restricted` flag, the tool can't remove it: point the person to Xcode Settings › Components, or leave it and report it. Never turn off SIP.

## Report

- **Lead with free space now,** the measured change, and any space other jobs used up in the meantime.
- **List what was removed:** path, size, reason, and what reinstalls it. Then what's unresolved, and the families or folders that weren't fully inspected.
- **Then the opportunities that are left,** grouped as regenerable caches, optional installed software, and data that needs the person's decision. Each line has a stable number, the exact path or selector, the measured size of the part that's eligible, what it holds, the evidence of use, and the condition that would make it safe.
- **Never inflate a total:** no parent and child counted twice, no "all versions" when one must stay, no empty device registrations, no virtual disk's maximum capacity, no personal files called cache. Folder sizes and deletion totals aren't recovered space: only `df` before and after is.
- **If fewer real candidates remain than were asked for,** say so and name what wasn't inspected. Never pad the list.
- **Check before claiming done:** removed paths are gone, kept active resources still work, lockfiles are unchanged and Git history still reads. After a runtime removal, check the environments that depended on it and the default executable. After an uninstall, check the app, its leftovers and its services. Name anything that must be reinstalled before reuse.

## Tools

- [The discovery checklist](references/discovery.md) for broad audits.
- [The macOS notes](references/macos.md). Read the section for what you're about to touch before an app or runtime uninstall, an administrator batch, Git objects, devices and SDKs, or compression. They also cover use probes, APFS block sharing and the DeviceFS virtual view.
- `<skill>/scripts/inventory.py` reads metadata only. It never decides what to delete and never removes anything. It skips symlinks and other filesystems, counts a hardlinked file once per root, and compares with an earlier snapshot.

```bash
cleanup_audit="$HOME/Library/Logs/storage-cleanup/$(date +%Y%m%d-%H%M%S)"
umask 077
mkdir -p "$cleanup_audit"
python3 "<skill>/scripts/inventory.py" --root "$HOME/Developer" --output "$cleanup_audit/inventory.json"
```

Add roots with more `--root` flags, compare with `--compare <earlier inventory.json>`, and see `--help` for the rest. `--max-depth` limits the summaries, not the walk, so scan one root at a time. A broad scan takes minutes: tell the person what's running and read the compact summary, never the whole file. A partial scan stays labeled partial.
