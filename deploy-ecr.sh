#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-ecr.sh
# Đóng gói 3 Docker images và đẩy lên Amazon ECR.
#
# Cách dùng: bash deploy-ecr.sh [aws-region]
# Ví dụ:     bash deploy-ecr.sh us-east-1
#
# Yêu cầu:
#   - AWS CLI v2 đã cài và cấu hình (aws configure hoặc AWS_PROFILE)
#   - Docker Desktop đang chạy
#   - Quyền AWS: ecr:GetAuthorizationToken, ecr:CreateRepository,
#                ecr:BatchCheckLayerAvailability, ecr:PutImage
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── 0. Tham số đầu vào ────────────────────────────────────────────────────────
AWS_REGION="${1:-us-east-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================================"
echo " deploy-ecr.sh — Triển khai Docker Images lên ECR"
echo " Region: ${AWS_REGION}"
echo " Thư mục gốc: ${SCRIPT_DIR}"
echo "========================================================"

# ── 1. Kiểm tra công cụ cần thiết ────────────────────────────────────────────
for cmd in aws docker; do
  if ! command -v "${cmd}" &> /dev/null; then
    echo "❌ Lỗi: '${cmd}' chưa được cài đặt hoặc không có trong PATH."
    exit 1
  fi
done
echo "✅ Đã kiểm tra công cụ: aws, docker."

# ── 2. Xác thực AWS và lấy Account ID ────────────────────────────────────────
echo ""
echo "🔍 Đang xác thực AWS CLI..."
ACCOUNT_ID=$(aws sts get-caller-identity \
  --query Account \
  --output text \
  --region "${AWS_REGION}")

if [[ -z "${ACCOUNT_ID}" ]]; then
  echo "❌ Lỗi: Không lấy được AWS Account ID."
  echo "   Kiểm tra: aws configure list | aws sts get-caller-identity"
  exit 1
fi

ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
echo "✅ AWS Account ID : ${ACCOUNT_ID}"
echo "✅ ECR Registry   : ${ECR_REGISTRY}"

# ── 3. Đăng nhập vào ECR ──────────────────────────────────────────────────────
echo ""
echo "🔐 Đang đăng nhập vào Amazon ECR..."
aws ecr get-login-password \
  --region "${AWS_REGION}" | \
  docker login \
    --username AWS \
    --password-stdin \
    "${ECR_REGISTRY}"
echo "✅ Đăng nhập ECR thành công."

# ── 4. Tạo ECR Repositories nếu chưa tồn tại ─────────────────────────────────
# Đặt tên theo quy ước dự án antigroup-*
REPOS=("antigroup-frontend" "antigroup-core" "antigroup-realtime")

echo ""
echo "📦 Kiểm tra và tạo ECR Repositories..."
for REPO in "${REPOS[@]}"; do
  if aws ecr describe-repositories \
      --repository-names "${REPO}" \
      --region "${AWS_REGION}" \
      --output text > /dev/null 2>&1; then
    echo "  ✓ Repository '${REPO}' đã tồn tại — bỏ qua."
  else
    echo "  + Đang tạo repository '${REPO}'..."
    aws ecr create-repository \
      --repository-name "${REPO}" \
      --region "${AWS_REGION}" \
      --image-scanning-configuration scanOnPush=true \
      --image-tag-mutability MUTABLE \
      --output text > /dev/null
    echo "  ✅ Đã tạo repository '${REPO}'."
  fi
done

# ── 5. Hàm Build → Tag → Push ─────────────────────────────────────────────────
build_and_push() {
  local SERVICE_LABEL="$1"   # Tên hiển thị trong log
  local REPO_NAME="$2"       # Tên ECR repository
  local BUILD_CONTEXT="$3"   # Đường dẫn đến thư mục chứa Dockerfile

  local IMAGE_LOCAL="${REPO_NAME}:latest"
  local IMAGE_ECR="${ECR_REGISTRY}/${REPO_NAME}:latest"

  echo ""
  echo "────────────────────────────────────────────────────────"
  echo "  [${SERVICE_LABEL}]"
  echo "  Build context : ${BUILD_CONTEXT}"
  echo "  ECR target    : ${IMAGE_ECR}"
  echo "────────────────────────────────────────────────────────"

  # Build cho linux/amd64 — tương thích ECS Fargate (kể cả build trên Mac M1/M2)
  echo "🔨 Building..."
  docker build \
    --platform linux/amd64 \
    --tag "${IMAGE_LOCAL}" \
    "${BUILD_CONTEXT}"

  echo "🏷️  Tagging..."
  docker tag "${IMAGE_LOCAL}" "${IMAGE_ECR}"

  echo "⬆️  Pushing..."
  docker push "${IMAGE_ECR}"

  echo "✅ [${SERVICE_LABEL}] Push thành công!"
}

# ── 6. Build và Push 3 services ───────────────────────────────────────────────
echo ""
echo "🚀 Bắt đầu build và push images..."

# Frontend: Nginx + React (port 80)
build_and_push \
  "Frontend (Nginx)" \
  "antigroup-frontend" \
  "${SCRIPT_DIR}/apps/frontend"

# Backend Core: REST API (port 3000)
build_and_push \
  "Backend-Core (REST API)" \
  "antigroup-core" \
  "${SCRIPT_DIR}/apps/backend-core"

# Backend Realtime: WebSocket Engine (port 4000)
build_and_push \
  "Backend-Realtime (WebSocket)" \
  "antigroup-realtime" \
  "${SCRIPT_DIR}/apps/backend-realtime"

# ── 7. In tóm tắt kết quả ─────────────────────────────────────────────────────
echo ""
echo "========================================================"
echo " ✅ HOÀN THÀNH — Tất cả images đã được push lên ECR"
echo "========================================================"
echo ""
echo " ECR Image URIs:"
echo ""
echo "   Frontend  : ${ECR_REGISTRY}/antigroup-frontend:latest"
echo "   Core      : ${ECR_REGISTRY}/antigroup-core:latest"
echo "   Realtime  : ${ECR_REGISTRY}/antigroup-realtime:latest"
echo ""
echo "──────────────────────────────────────────────────────"
echo " 📝 Cập nhật terraform/terraform.tfvars:"
echo ""
echo "   frontend_image         = \"${ECR_REGISTRY}/antigroup-frontend:latest\""
echo "   core_backend_image     = \"${ECR_REGISTRY}/antigroup-core:latest\""
echo "   realtime_backend_image = \"${ECR_REGISTRY}/antigroup-realtime:latest\""
echo ""
echo " Sau đó chạy: bash deploy-infrastructure.sh"
echo "========================================================"
