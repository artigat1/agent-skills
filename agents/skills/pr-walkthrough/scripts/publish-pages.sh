#!/usr/bin/env bash
# Publish a viewer page to the private walkthroughs site.
#
#   publish-pages.sh <viewer.html> <source repo name> <pr number>
#
# Copies the page to <repo>/<pr>/index.html in a local clone of the site repo,
# commits, pushes, and prints the URL a PR body should link. The site is a
# private GitHub Pages site: only people with access to the repo can open it.
# Until Pages is enabled on the repo, the file is still pushed and the printed
# line says where it landed.
set -euo pipefail

if (( $# != 3 )); then
  echo "usage: publish-pages.sh <viewer.html> <source repo name> <pr number>" >&2
  exit 2
fi
viewer="$1"; source_repo="$2"; pr="$3"
pages_repo="${PR_LENS_PAGES_REPO:?Set PR_LENS_PAGES_REPO to an approved private owner/repo}"

if [[ ! -s "$viewer" ]]; then
  echo "viewer not found: ${viewer}" >&2
  exit 1
fi
if [[ ! "$pr" =~ ^[1-9][0-9]*$ ]]; then
  echo "pr number must be a positive integer: ${pr}" >&2
  exit 1
fi
if [[ ! "$source_repo" =~ ^[A-Za-z0-9._-]+$ || "$source_repo" == "." || "$source_repo" == ".." ]]; then
  echo "source repo must be a bare repo name like storefront: ${source_repo}" >&2
  exit 1
fi

# Fail closed before cloning or pushing: walkthroughs contain private PR context.
if [[ "$(gh api "repos/${pages_repo}" -q .private)" != "true" ]]; then
  echo "refusing to publish: ${pages_repo} is not private" >&2
  exit 1
fi
pages_clone_url="$(gh api "repos/${pages_repo}" -q .clone_url)"
pages_ssh_url="$(gh api "repos/${pages_repo}" -q .ssh_url)"
pages_error="$(mktemp)"
if pages_public="$(gh api "repos/${pages_repo}/pages" -q '.public' 2>"$pages_error")"; then
  if [[ "$pages_public" != "false" ]]; then
    rm -f "$pages_error"
    echo "refusing to publish: Pages for ${pages_repo} is public or its visibility is unknown" >&2
    exit 1
  fi
else
  if ! grep -q 'HTTP 404' "$pages_error"; then
    cat "$pages_error" >&2
    rm -f "$pages_error"
    exit 1
  fi
  # A 404 is safe only when Pages is disabled, not when the endpoint is hidden.
  has_pages="$(gh api "repos/${pages_repo}" -q '.has_pages')"
  if [[ "$has_pages" != "false" ]]; then
    rm -f "$pages_error"
    echo "refusing to publish: Pages endpoint returned 404 although Pages is enabled" >&2
    exit 1
  fi
fi
rm -f "$pages_error"

temp_root="$(mktemp -d "${TMPDIR:-/tmp}/pr-lens-publish.XXXXXX")"
trap 'rm -rf "$temp_root"' EXIT
clone_dir="${temp_root}/site"
gh repo clone "$pages_repo" "$clone_dir" -- --depth 1 --quiet
clone_origin="$(git -C "$clone_dir" remote get-url origin)"
if [[ "$clone_origin" != "$pages_clone_url" && "$clone_origin" != "$pages_ssh_url" ]]; then
  echo "refusing to publish: cloned origin does not match ${pages_repo}" >&2
  exit 1
fi

target="${clone_dir}/${source_repo}/${pr}"
mkdir -p "$target"
cp "$viewer" "${target}/index.html"
published_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '{"repo":"%s","pr":%s,"publishedAt":"%s"}\n' "$source_repo" "$pr" "$published_at" > "${target}/meta.json"

git -C "$clone_dir" add -- "${source_repo}/${pr}"
if git -C "$clone_dir" diff --cached --quiet; then
  echo "nothing changed for ${source_repo}#${pr}" >&2
else
  git -C "$clone_dir" commit -q -m "${source_repo}#${pr}: walkthrough viewer"
  git -C "$clone_dir" push -q origin HEAD
fi

site_branch="$(git -C "$clone_dir" branch --show-current)"
base="$(gh api "repos/${pages_repo}/pages" -q .html_url 2>/dev/null)" || base=""
if [[ -n "$base" ]]; then
  printf '%s%s/%s/\n' "${base%/}/" "$source_repo" "$pr"
else
  echo "pushed to ${pages_repo}:${source_repo}/${pr}/index.html — Pages is not enabled on that repo yet, so there is no URL to link" >&2
  printf 'https://github.com/%s/blob/%s/%s/%s/index.html\n' "$pages_repo" "$site_branch" "$source_repo" "$pr"
fi
