#!/bin/sh
# Assembles the deployable site.
#
# The repo is deliberately not the publish directory: assets/audio holds
# commercial recordings that were only ever development scratch, and the site
# streams live radio now, so none of it belongs on a public URL. docs/ and
# tests/ have no business there either.
set -eu

rm -rf dist
mkdir -p dist
cp index.html dist/
cp -R styles dist/
cp -R src dist/

echo "dist/ assembled:"
find dist -type f | sort
