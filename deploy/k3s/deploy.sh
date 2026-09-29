#!/usr/bin/env bash
set -euo pipefail

fail() { printf '%s\n' "$*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || fail 'Run with sudo on the K3s server.'
kubectl_local() { k3s kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml "$@"; }
kubectl_local -n toy01 get secret toy01-tls >/dev/null 2>&1 \
  || fail 'Create the TLS secret first (see deploy/k3s/README.md).'

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
image="docker.io/library/toy01:$(git rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M%S)"
printf 'Building %s\n' "$image"
docker build --tag "$image" .
docker save "$image" | k3s ctr --namespace k8s.io images import -
sed "s|__IMAGE__|$image|" deploy/k3s/app.yaml | kubectl_local apply -f -
kubectl_local -n toy01 rollout status deployment/toy01 --timeout=180s
printf '\nReady: https://toy01.emul.site\n'
