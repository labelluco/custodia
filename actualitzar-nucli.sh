#!/bin/bash
# Copia el nucli compartit (../nucli) dins d'aquesta app (./nucli) i
# n'anota la versió (commit) a nucli/VERSIO.
#
# Per què una còpia i no un submòdul: Codeberg Pages no serveix els
# submòduls, i l'app ha de funcionar sola (també fora de línia). La
# còpia queda versionada amb l'app; el fitxer VERSIO diu de quin commit
# del nucli ve.
#
# Ús (Git Bash, des de la carpeta de l'app):
#   ./actualitzar-nucli.sh            (fa servir ../nucli)
#   ./actualitzar-nucli.sh /cami/nucli
set -e

ORIGEN="${1:-../nucli}"

if [ ! -f "$ORIGEN/js/i18n/i18n.js" ]; then
  echo "No trobo el nucli a $ORIGEN"
  exit 1
fi

rm -rf nucli
mkdir -p nucli
cp -r "$ORIGEN/js" "$ORIGEN/css" "$ORIGEN/eines" nucli/
cp "$ORIGEN/LICENSE" nucli/

VERSIO=$(git -C "$ORIGEN" describe --tags --always --dirty 2>/dev/null || echo "sense-git")
echo "$VERSIO" > nucli/VERSIO

echo "Nucli copiat ($VERSIO). Recorda:"
echo "  - node nucli/eines/verificar.mjs"
echo "  - pujar NOM_CACHE a service-worker.js"
