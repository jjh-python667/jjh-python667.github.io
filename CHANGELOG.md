# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.1] - 2026-11-11

### Added

- Bilingual README for the static GitHub Pages portfolio: what the site is, the sections that are actually on the homepage and in the sitemap, how to build and preview locally, and the repository layout.
- Vendored GSAP files in `site/assets/vendor/gsap/` are unchanged.
- GitHub Actions workflow `.github/workflows/site-patrol.yml`. It runs daily and on manual dispatch, checks the public portfolio and treats the Deal Hunter worker as optional, checks linked URLs, runs free Lighthouse performance and accessibility audits, and compares a SHA-256 of the homepage HTML with `.github/patrol/baseline.json`.
- `npm run patrol` for a local dry-run that does not open issues and does not call GitHub Models.
- Sample report `.github/patrol/sample.md`, produced by that dry-run against the live URLs.

### Changed

- `.gitignore` now ignores local patrol output, Lighthouse report files, and common OS junk.

Page design, page copy, and GitHub Pages settings are unchanged.

## [1.2.0] - 2026-11-10

### Added

- Deal Hunter project card, project page, local screenshots, and public source link, as already described in the README shipped with that update.
- Portfolio notes for the Pygame practice fixes that were already published with that update.
