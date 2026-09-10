#!/bin/sh
# Assembles the deployable site.
#
# The repo is deliberately not the publish directory: assets/audio holds
# commercial recordings that were only ever development scratch, and the site
# streams live radio now, so none of it belongs on a public URL. docs/ and
# tests/ have no business there either. assets/textures and assets/models are
# the exceptions: the scans the surfaces are built from, the car, and the
# passenger. Without the textures the scene falls back to procedural ones;
# without the models there is no car and no passenger.
set -eu

rm -rf dist
mkdir -p dist
cp index.html dist/
cp -R styles dist/
cp -R src dist/
mkdir -p dist/assets
cp -R assets/textures dist/assets/
cp -R assets/models dist/assets/

echo "dist/ assembled:"
find dist -type f | sort
