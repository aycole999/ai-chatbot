#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

IMAGE_NAME="${1:-${AI_CHATBOT_IMAGE:-ai-chatbot:latest}}"

echo "Building image: ${IMAGE_NAME}"
echo "Project root: ${PROJECT_ROOT}"

docker build \
  -f "${PROJECT_ROOT}/Dockerfile" \
  -t "${IMAGE_NAME}" \
  "${PROJECT_ROOT}"
