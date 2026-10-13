#!/bin/sh
set -eu

source_ca="${1:?usage: stage-upstream-ca.sh SOURCE DESTINATION}"
staged_ca="${2:?usage: stage-upstream-ca.sh SOURCE DESTINATION}"

test -s "$source_ca"
install -m 0644 "$source_ca" "$staged_ca"
