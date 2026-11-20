#!/usr/bin/env bash
# Link skills from this clone into your agents' skill folders, so a `git pull` updates them in place.
#
#   scripts/link-skills.sh                   the design and qol shelves into ~/.claude/skills and ~/.agents/skills
#   scripts/link-skills.sh design drops      the shelves you name
#   scripts/link-skills.sh all               every shelf (what Charles' computers use)
#
# A link that points at a skill this repo no longer has is removed. A real folder with a skill's name is left
# alone and reported: it's probably a copy from `npx skills add`, so delete it yourself if you want the link.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
shelves=(design editing qol drops)

# skill folders on the chosen shelves, as "shelf/name"
skills_on() {
  local shelf dir
  for shelf in "$@"; do
    for dir in "$repo/skills/$shelf"/*/; do
      [ -f "$dir/SKILL.md" ] && echo "$shelf/$(basename "$dir")"
    done
  done
}

# link <link path> <target>: make or refresh a symlink, never replacing a real folder
link() {
  local at="$1" target="$2"
  if [ -L "$at" ]; then
    [ "$(readlink "$at")" = "$target" ] && return 0
    rm "$at"
  elif [ -e "$at" ]; then
    echo "skipped  $at is a real folder, not a link" >&2
    return 0
  fi
  ln -s "$target" "$at"
  echo "linked   $at -> $target"
}

# remove links in <folder> that point into this repo's skills/ at something that's gone
prune() {
  local folder="$1" at target
  for at in "$folder"/*; do
    [ -L "$at" ] || continue
    target="$(readlink "$at")"
    case "$target" in
      */skills/design/*|*/skills/editing/*|*/skills/qol/*|*/skills/drops/*|*charles-skills/skills/*) ;;
      *) continue ;;
    esac
    if [ ! -e "$at" ]; then rm "$at"; echo "removed  $at (its skill moved or was deleted)"; fi
  done
}

chosen=("$@")
[ ${#chosen[@]} -eq 0 ] && chosen=(design qol)
[ "${chosen[0]}" = "all" ] && chosen=("${shelves[@]}")
for shelf in "${chosen[@]}"; do
  [ -d "$repo/skills/$shelf" ] || { echo "no shelf called $shelf (pick from: ${shelves[*]})" >&2; exit 1; }
done
for home in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
  mkdir -p "$home"
  prune "$home"
  while read -r item; do
    link "$home/${item#*/}" "$repo/skills/$item"
  done < <(skills_on "${chosen[@]}")
done
