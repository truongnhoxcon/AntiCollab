# Tài liệu Thiết kế: Triển khai Chat Real-time lên AWS Cloud

## Tổng quan

Tài liệu này hướng dẫn quy trình triển khai hệ thống Real-time Streaming & Collaboration lên AWS Cloud, tập trung vào **luồng Chat Real-time** (bỏ qua tính năng Voice/WebRTC để cập nhật sau). Hệ thống gồm 3 dịch vụ container chính được điều phối bằng Terraform + ECS Fargate.

### Mục tiêu thiết kế

- **Tự động hóa**: Toàn bộ quy trình từ đóng gói image đến tạo hạ tầng được tự động bằng script
- **CI/CD sẵn sàng**: Kiến trúc hỗ trợ rolling update, zero-downtime deployment
- **Bảo mật mạng**: Backend cô lập trong Private Subnet, chỉ ALB mở ra Internet
- **Đơn giản cho MVP**: Bỏ qua WebRTC, tập trung vào Chat + REST API

---

## High-Level Design

### 1. Kiến trúc Tổng thể

```
Internet
   │
   ▼
Application Load Balancer (Public, HTTPS 443 / HTTP 80)
   │
   ├─── /api/*  ──────────────► ECS Fargate: backend-core  (port 3000)
   │                                          │         │
   │                                       RDS PG    S3 Files
   │
   └─── /ws/*   ──────────────► ECS Fargate: backend-realtime (port 4000)
                                              │
                                         ElastiCache Redis
                                         (Pub/Sub + Cache)

Frontend (Nginx port 80) → Được serve qua ALB hoặc S3/CloudFront (ngoài scope MVP)
```

### 2. Sơ đồ mạng VPC

```
VPC: 10.0.0.0/16
│
├── Public Subnets (us-east-1a, us-east-1b)
│     ├── Application Load Balancer
│     └── NAT Gateway
│
└── Private Subnets (us-east-1a, us-east-1b)
      ├── ECS Fargate Tasks (backend-core + backend-realtime)
      ├── RDS PostgreSQL (Single-AZ, db.t3.medium)
      └── ElastiCache Redis (Single-AZ, cache.t3.medium)
```

### 3. Luồng định tuyến ALB → ECS

| Path Pattern | Target Group          | ECS Service       | Container Port |
|-------------|----------------------|-------------------|----------------|
| `/api/*`    | `core-backend-tg`    | `backend-core`    | 3000           |
| `/ws/*`     | `realtime-backend-tg`| `backend-realtime`| 4000           |

**Sticky Sessions**: Bật cho `/ws/*` (WebSocket), thời lượng 1 giờ, đảm bảo một kết nối WebSocket luôn đi đến cùng một ECS task.

### 4. Cơ chế kết nối nội bộ

```
backend-core  ─── DB_HOST  = <RDS endpoint>     (port 5432, Private Subnet)
              ─── REDIS_HOST = <Redis endpoint>  (port 6379, Private Subnet)

backend-realtime ─── REDIS_HOST = <Redis endpoint>  (Pub/Sub chính)
                 ─── DB_HOST    = <RDS endpoint>    (ghi async messages)
```

Cả hai service đều lấy secrets từ **AWS Secrets Manager** tại runtime, không hardcode trong image:
- `DB_PASSWORD` → secret `db-password`
- `JWT_SECRET`  → secret `jwt-secret`

---

## Low-Level Design

### BƯỚC 1: Script Đóng gói và Đẩy Images lên ECR

**File: `deploy-ecr.sh`** — Tạo tại thư mục gốc dự án.

Script thực hiện:
1. Lấy AWS Account ID tự động
2. Tạo 3 ECR repos nếu chưa tồn tại: `antigroup-frontend`, `antigroup-core`, `antigroup-realtime`
3. Build + tag + push cả 3 Docker images

```bash
#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-ecr.sh
# Đóng gói 3 Docker images và đẩy lên Amazon ECR.
# Cách dùng: bash deploy-ecr.sh [aws-region]
# Ví dụ:     bash deploy-ecr.sh us-east-1
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── 0. Tham số đầu vào ────────────────────────────────────────────────────────
AWS_REGION="${1:-us-east-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 [deploy-ecr.sh] Bắt đầu triển khai lên ECR | Region: ${AWS_REGION}"

# ── 1. Lấy AWS Account ID ─────────────────────────────────────────────────────
echo "🔍 Đang xác thực AWS CLI..."
ACCOUNT_ID=$(aws sts get-caller-identity \
  --query Account \
  --output text \
  --region "${AWS_REGION}")

if [[ -z "${ACCOUNT_ID}" ]]; then
  echo "❌ Lỗi: Không lấy được AWS Account ID. Kiểm tra cấu hình AWS CLI."
  exit 1
fi

ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
echo "✅ AWS Account ID: ${ACCOUNT_ID}"
echo "✅ ECR Registry: ${ECR_REGISTRY}"

# ── 2. Đăng nhập vào ECR ──────────────────────────────────────────────────────
echo ""
echo "🔐 Đang đăng nhập vào Amazon ECR..."
aws ecr get-login-password \
  --region "${AWS_REGION}" | \
docker login \
  --username AWS \
  --password-stdin \
  "${ECR_REGISTRY}"
echo "✅ Đăng nhập ECR thành công."

# ── 3. Tạo ECR Repositories nếu chưa tồn tại ─────────────────────────────────
REPOS=("antigroup-frontend" "antigroup-core" "antigroup-realtime")

echo ""
echo "📦 Kiểm tra và tạo ECR Repositories..."
for REPO in "${REPOS[@]}"; do
  if aws ecr describe-repositories \
      --repository-names "${REPO}" \
      --region "${AWS_REGION}" \
      --output text > /dev/null 2>&1; then
    echo "  ✓ Repository '${REPO}' đã tồn tại."
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

# ── 4. Build, Tag và Push từng image ──────────────────────────────────────────

build_and_push() {
  local SERVICE_NAME="$1"    # Tên hiển thị
  local REPO_NAME="$2"       # Tên ECR repo
  local BUILD_CONTEXT="$3"   # Đường dẫn thư mục chứa Dockerfile

  local IMAGE_URI="${ECR_REGISTRY}/${REPO_NAME}:latest"

  echo ""
  echo "🔨 [${SERVICE_NAME}] Đang build Docker image..."
  echo "   Build context: ${BUILD_CONTEXT}"
  echo "   Target URI:    ${IMAGE_URI}"

  docker build \
    --platform linux/amd64 \
    -t "${REPO_NAME}:latest" \
    "${BUILD_CONTEXT}"

  echo "🏷️  [${SERVICE_NAME}] Đang gắn tag ECR..."
  docker tag "${REPO_NAME}:latest" "${IMAGE_URI}"

  echo "⬆️  [${SERVICE_NAME}] Đang push lên ECR..."
  docker push "${IMAGE_URI}"

  echo "✅ [${SERVICE_NAME}] Push thành công: ${IMAGE_URI}"
}

# Frontend (Nginx + React build)
build_and_push \
  "Frontend" \
  "antigroup-frontend" \
  "${SCRIPT_DIR}/apps/frontend"

# Backend Core (REST API, port 3000)
build_and_push \
  "Backend-Core" \
  "antigroup-core" \
  "${SCRIPT_DIR}/apps/backend-core"

# Backend Realtime (WebSocket, port 4000)
build_and_push \
  "Backend-Realtime" \
  "antigroup-realtime" \
  "${SCRIPT_DIR}/apps/backend-realtime"

# ── 5. In tóm tắt để team Frontend lấy URIs ──────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Hoàn thành! Các ECR Image URIs:"
echo ""
echo "  FRONTEND:  ${ECR_REGISTRY}/antigroup-frontend:latest"
echo "  CORE:      ${ECR_REGISTRY}/antigroup-core:latest"
echo "  REALTIME:  ${ECR_REGISTRY}/antigroup-realtime:latest"
echo ""
echo "📝 Cập nhật terraform/terraform.tfvars với giá trị sau:"
echo ""
echo "  core_backend_image     = \"${ECR_REGISTRY}/antigroup-core:latest\""
echo "  realtime_backend_image = \"${ECR_REGISTRY}/antigroup-realtime:latest\""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

**Ghi chú cho macOS / Apple Silicon (M1/M2/M3)**:
Script đã thêm flag `--platform linux/amd64` để đảm bảo image tương thích với ECS Fargate (chạy trên x86_64). Nếu không có flag này, build trên ARM chip sẽ tạo ra ARM image không chạy được trên Fargate.

---

### BƯỚC 2: Cấu hình Terraform

#### 2.1 Tạo file `terraform/terraform.tfvars`

Sao chép từ `terraform.tfvars.example` và điền các giá trị thực:

```hcl
# terraform/terraform.tfvars
# KHÔNG commit file này lên Git (đã có trong .gitignore)

# ── Thông tin chung ──────────────────────────────────────────────────────────
aws_region   = "us-east-1"
environment  = "dev"                 # dev | staging | prod
project_name = "realtime-collab"
account_id   = "123456789012"        # ← Thay bằng 12 chữ số Account ID của bạn

# ── Mạng ─────────────────────────────────────────────────────────────────────
vpc_cidr = "10.1.0.0/16"             # dev: 10.1 | staging: 10.2 | prod: 10.0

# ── ECR Image URIs (điền sau khi chạy deploy-ecr.sh) ─────────────────────────
# Cấu trúc: <account_id>.dkr.ecr.<region>.amazonaws.com/<repo>:latest
core_backend_image     = "123456789012.dkr.ecr.us-east-1.amazonaws.com/antigroup-core:latest"
realtime_backend_image = "123456789012.dkr.ecr.us-east-1.amazonaws.com/antigroup-realtime:latest"

# ── DNS / ACM ────────────────────────────────────────────────────────────────
# Certificate Manager phải có cert cho domain này trước khi apply
domain_name = "dev.yourdomain.com"

# ── Cảnh báo ─────────────────────────────────────────────────────────────────
alert_email = "devops@yourdomain.com"
```

#### 2.2 Cơ chế ECS Task Definition nạp biến môi trường

Terraform module `modules/ecs/task-definitions.tf` đã cấu hình sẵn:

```hcl
# backend-core nhận endpoint kết nối qua biến môi trường tại runtime
environment = [
  { name = "NODE_ENV",   value = "production" },
  { name = "DB_HOST",    value = var.db_host },    # ← RDS endpoint tự động từ module.rds
  { name = "REDIS_HOST", value = var.redis_host }, # ← Redis endpoint từ module.elasticache
  { name = "AWS_REGION", value = var.aws_region }
]

# Secrets được inject từ Secrets Manager (KHÔNG lưu trong image)
secrets = [
  { name = "DB_PASSWORD", valueFrom = var.db_password_secret_arn },
  { name = "JWT_SECRET",  valueFrom = var.jwt_secret_arn }
]
```

Luồng giá trị: `terraform apply` → Terraform lấy output từ module RDS/ElastiCache → truyền vào ECS Task Definition → ECS inject vào container khi khởi động. **Team Frontend và Backend không cần biết endpoint thực** — chỉ cần đọc từ biến môi trường trong code.

#### 2.3 Lấy ALB URL sau khi deploy

Sau `terraform apply`, chạy lệnh:
```bash
terraform -chdir=terraform output alb_dns_name
```

Giá trị trả về dạng: `realtime-collab-alb-XXXXXXXX.us-east-1.elb.amazonaws.com`

**Team Frontend** nạp URL này vào biến môi trường của ứng dụng:
```javascript
// apps/frontend/src/config.js (hoặc .env.production)
VITE_API_BASE_URL = "https://realtime-collab-alb-XXXX.us-east-1.elb.amazonaws.com/api"
VITE_WS_URL      = "wss://realtime-collab-alb-XXXX.us-east-1.elb.amazonaws.com/ws"
```

Nếu có domain riêng, cấu hình DNS CNAME trỏ domain về ALB DNS name.

---

### BƯỚC 3: Quy trình thi công hạ tầng Terraform

#### 3.1 Điều kiện tiên quyết

Trước khi chạy Terraform, đảm bảo:
1. AWS CLI đã cấu hình (`aws configure` hoặc biến môi trường `AWS_PROFILE`)
2. Terraform >= 1.6 đã cài đặt
3. Docker images đã push lên ECR (BƯỚC 1 hoàn thành)
4. File `terraform/terraform.tfvars` đã điền đủ giá trị
5. ACM Certificate cho `domain_name` đã tồn tại trong AWS Certificate Manager

#### 3.2 Chuỗi lệnh Terraform

```bash
# ── Bước 3.1: Khởi tạo Terraform (tải providers, khởi tạo backend) ─────────
cd terraform
terraform init

# ── Bước 3.2: Kiểm tra cú pháp và validate cấu hình ───────────────────────
terraform validate

# ── Bước 3.3: Xem trước kế hoạch (KHÔNG tốn tiền, chỉ đọc) ────────────────
# Lưu plan ra file để apply chính xác từng bước
terraform plan \
  -var-file="terraform.tfvars" \
  -out="deployment.tfplan"

# ── Bước 3.4: Triển khai hạ tầng (TỐN TIỀN từ bước này) ───────────────────
# -auto-approve: bỏ qua xác nhận tay (dùng cho CI/CD)
# Bỏ -auto-approve nếu muốn xem lại lần cuối trước khi tạo
terraform apply "deployment.tfplan"

# ── Bước 3.5: Kiểm tra outputs sau khi deploy ──────────────────────────────
terraform output
# Hoặc lấy ALB URL riêng:
terraform output alb_dns_name
```

#### 3.3 Thứ tự tạo tài nguyên (tự động)

Terraform tự giải quyết dependencies theo thứ tự:

```
1. Secrets Manager     (db-password, jwt-secret, twilio, redis-auth)
2. VPC                 (10.1.0.0/16, public/private subnets, IGW, NAT)
3. Security Groups     (alb-sg, core-backend-sg, realtime-backend-sg, rds-sg, redis-sg)
4. S3                  (file storage, ALB logs bucket)
5. IAM                 (ECS execution role, ECS task role)
6. RDS PostgreSQL      (private subnet, db.t3.medium)
7. ElastiCache Redis   (private subnet, cache.t3.medium)
8. ALB                 (public subnet, target groups, listener rules)
9. ECS Cluster         (Fargate)
10. ECS Task Defs      (core-backend + realtime-backend với ECR image URIs)
11. ECS Services       (desired: 2 tasks mỗi service, auto-scaling)
```

Thời gian ước tính: **15–25 phút** (RDS và ElastiCache mất nhiều thời gian nhất).

#### 3.4 Script tổng hợp deploy-infrastructure.sh

```bash
#!/usr/bin/env bash
# deploy-infrastructure.sh
# Chạy toàn bộ quy trình Terraform một lần.
# Cách dùng: bash deploy-infrastructure.sh [environment]
# Ví dụ:     bash deploy-infrastructure.sh dev

set -euo pipefail

ENVIRONMENT="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/terraform"

echo "🏗️  Bắt đầu thi công hạ tầng AWS | Môi trường: ${ENVIRONMENT}"

# Kiểm tra terraform.tfvars tồn tại
if [[ ! -f "${TF_DIR}/terraform.tfvars" ]]; then
  echo "❌ Lỗi: Không tìm thấy ${TF_DIR}/terraform.tfvars"
  echo "   Hãy copy terraform.tfvars.example → terraform.tfvars và điền giá trị."
  exit 1
fi

cd "${TF_DIR}"

echo ""
echo "── Bước 1/4: terraform init ─────────────────────────────────────────────"
terraform init -upgrade

echo ""
echo "── Bước 2/4: terraform validate ────────────────────────────────────────"
terraform validate

echo ""
echo "── Bước 3/4: terraform plan ─────────────────────────────────────────────"
terraform plan \
  -var-file="terraform.tfvars" \
  -out="deployment.tfplan"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -rp "⚠️  Xem xét plan ở trên. Tiếp tục Apply? [y/N]: " CONFIRM
if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
  echo "🛑 Đã hủy. File plan: deployment.tfplan (vẫn có thể dùng lại)."
  exit 0
fi

echo ""
echo "── Bước 4/4: terraform apply ────────────────────────────────────────────"
terraform apply "deployment.tfplan"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Hạ tầng đã được tạo thành công!"
echo ""
echo "📋 Thông tin kết nối:"
terraform output
echo ""
echo "🌐 ALB URL (team Frontend dùng làm base URL):"
ALB_URL=$(terraform output -raw alb_dns_name)
echo "   https://${ALB_URL}"
echo ""
echo "📝 Biến môi trường cho Frontend:"
echo "   VITE_API_BASE_URL=https://${ALB_URL}/api"
echo "   VITE_WS_URL=wss://${ALB_URL}/ws"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

## Luồng CI/CD tổng thể (sau MVP)

```
Git push main
     │
     ▼
CI (GitHub Actions / GitLab CI)
     │
     ├── docker build + push → ECR (antigroup-core:sha-xxxxx, antigroup-realtime:sha-xxxxx)
     │
     └── aws ecs update-service --force-new-deployment
                │
                ▼
         ECS Rolling Update
         (new tasks start → health check pass → old tasks drain → terminate)
                │
                ▼
         Zero-downtime deployment ✅
```

### Lấy ALB DNS nhanh (dành cho team Frontend)

```bash
# Sau terraform apply, chạy lệnh này để lấy URL:
cd terraform && terraform output -raw alb_dns_name

# Hoặc dùng AWS CLI:
aws elbv2 describe-load-balancers \
  --names "realtime-collab-alb" \
  --query "LoadBalancers[0].DNSName" \
  --output text
```
