#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-infrastructure.sh
# Chạy toàn bộ quy trình Terraform: init → validate → plan → apply.
#
# Cách dùng: bash deploy-infrastructure.sh [--auto-approve]
# Ví dụ CI:  bash deploy-infrastructure.sh --auto-approve
# Ví dụ tay: bash deploy-infrastructure.sh
#
# Yêu cầu:
#   - Terraform >= 1.6 đã cài đặt
#   - AWS CLI v2 đã cấu hình
#   - terraform/terraform.tfvars đã điền đủ giá trị
#   - Docker images đã push lên ECR (chạy deploy-ecr.sh trước)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/terraform"
AUTO_APPROVE=false

# Xử lý tham số
for arg in "$@"; do
  case "${arg}" in
    --auto-approve) AUTO_APPROVE=true ;;
    *) echo "⚠️  Tham số không rõ: ${arg} (bỏ qua)" ;;
  esac
done

echo "========================================================"
echo " deploy-infrastructure.sh — Thi công hạ tầng AWS"
echo " Thư mục Terraform: ${TF_DIR}"
echo " Auto-approve: ${AUTO_APPROVE}"
echo "========================================================"

# ── Kiểm tra công cụ ─────────────────────────────────────────────────────────
for cmd in terraform aws; do
  if ! command -v "${cmd}" &> /dev/null; then
    echo "❌ Lỗi: '${cmd}' chưa được cài đặt."
    exit 1
  fi
done
echo "✅ Đã kiểm tra công cụ: terraform, aws."

# ── Kiểm tra terraform.tfvars ─────────────────────────────────────────────────
if [[ ! -f "${TF_DIR}/terraform.tfvars" ]]; then
  echo ""
  echo "❌ Lỗi: Không tìm thấy terraform/terraform.tfvars"
  echo ""
  echo "   Hãy thực hiện:"
  echo "   1. cp terraform/terraform.tfvars.example terraform/terraform.tfvars"
  echo "   2. Điền các giá trị: account_id, domain_name, alert_email, image URIs"
  echo "   3. Chạy lại script này."
  exit 1
fi
echo "✅ Đã tìm thấy terraform/terraform.tfvars."

cd "${TF_DIR}"

# ── Bước 1: terraform init ────────────────────────────────────────────────────
echo ""
echo "════ Bước 1/4: terraform init ═══════════════════════════════════════════"
terraform init -upgrade
echo "✅ terraform init hoàn thành."

# ── Bước 2: terraform validate ────────────────────────────────────────────────
echo ""
echo "════ Bước 2/4: terraform validate ══════════════════════════════════════"
terraform validate
echo "✅ Cấu hình hợp lệ."

# ── Bước 3: terraform plan ────────────────────────────────────────────────────
echo ""
echo "════ Bước 3/4: terraform plan ═══════════════════════════════════════════"
echo "    Đang phân tích kế hoạch triển khai (không tốn tiền)..."
terraform plan \
  -var-file="terraform.tfvars" \
  -out="deployment.tfplan"
echo "✅ terraform plan hoàn thành. File plan: deployment.tfplan"

# ── Bước 4: terraform apply ────────────────────────────────────────────────────
echo ""
echo "════ Bước 4/4: terraform apply ══════════════════════════════════════════"

if [[ "${AUTO_APPROVE}" == "false" ]]; then
  echo ""
  echo "  ⚠️  Xem xét plan ở trên trước khi tiếp tục."
  echo "  Tài nguyên sẽ được tạo và CÓ THỂ PHÁT SINH CHI PHÍ AWS."
  echo ""
  read -rp "  Tiếp tục Apply? [y/N]: " CONFIRM
  if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
    echo ""
    echo "🛑 Đã hủy bởi người dùng."
    echo "   File plan vẫn được lưu tại: ${TF_DIR}/deployment.tfplan"
    echo "   Để apply sau: cd terraform && terraform apply deployment.tfplan"
    exit 0
  fi
fi

terraform apply "deployment.tfplan"

# ── In kết quả sau deploy ──────────────────────────────────────────────────────
echo ""
echo "========================================================"
echo " ✅ HẠ TẦNG AWS ĐÃ ĐƯỢC TẠO THÀNH CÔNG!"
echo "========================================================"
echo ""
echo " 📋 Tất cả outputs:"
echo ""
terraform output
echo ""

# Lấy ALB DNS
ALB_URL=$(terraform output -raw alb_dns_name 2>/dev/null || echo "N/A")
ALB_RAW=$(terraform output -raw alb_raw_dns 2>/dev/null || echo "N/A")
ECS_CLUSTER=$(terraform output -raw ecs_cluster_name 2>/dev/null || echo "N/A")

echo "──────────────────────────────────────────────────────"
echo " 🌐 ALB Endpoint (Ingress URL):"
echo ""
echo "   ${ALB_URL}"
echo ""
echo " 📡 Định tuyến:"
echo "   REST API  → ${ALB_URL}/api/*"
echo "   WebSocket → ws://${ALB_RAW}/ws/*"
echo ""
echo " 📝 Biến môi trường cho team Frontend:"
echo ""
echo "   VITE_API_BASE_URL=${ALB_URL}/api"
echo "   VITE_WS_URL=ws://${ALB_RAW}/ws"
echo ""
echo " 🔍 Kiểm tra ECS Services:"
echo "   aws ecs list-tasks --cluster ${ECS_CLUSTER} --region us-east-1"
echo "──────────────────────────────────────────────────────"
echo ""
echo " ⏱  Lưu ý: ECS tasks cần 2-3 phút để khởi động và pass health checks."
echo "    Theo dõi: AWS Console → ECS → Clusters → ${ECS_CLUSTER}"
echo "========================================================"
