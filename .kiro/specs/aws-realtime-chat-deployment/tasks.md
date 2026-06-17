# Implementation Plan: AWS Real-time Chat Deployment

## Overview

Kế hoạch này chia quá trình triển khai thành 4 nhóm task tuần tự: tạo script deploy ECR, kiểm chứng cấu hình Terraform, chạy terraform init/plan/apply, và xác nhận sau triển khai. Ngôn ngữ triển khai: **Bash** cho scripting, **HCL (Terraform)** cho IaC.

## Tasks

- [ ] 1. Tạo script `deploy-ecr.sh` tự động hoá build và push Docker images
  - Tạo file `deploy-ecr.sh` ở thư mục gốc dự án với `set -euo pipefail`
  - Implement argument parsing cho `--account`, `--region`, `--tag`
  - Implement kiểm tra dependency tools (aws, docker)
  - Implement xác thực AWS credentials qua `aws sts get-caller-identity`
  - Implement auto-create ECR repos nếu chưa tồn tại (`aws ecr describe-repositories` + `aws ecr create-repository`)
  - Implement docker login với `aws ecr get-login-password`
  - Implement build loop cho 3 images: `antigroup-frontend` (apps/frontend), `antigroup-core` (apps/backend-core), `antigroup-realtime` (apps/backend-realtime) với `--platform linux/amd64`
  - Implement dual-tag logic: push `<tag>` và `latest` khi tag != "latest"
  - Implement output summary in ECR URIs cho core và realtime với hướng dẫn cập nhật tfvars
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [ ]* 1.1 Viết property test cho ECR URI format generation
    - **Property 1: ECR URI Format Correctness**
    - Dùng `bats-core` hoặc shellspec để test pure function tạo URI
    - Generate nhiều combinations của account_id (10 chữ số, 12 chữ số), region (us-east-1, ap-southeast-1, eu-west-1), repo name, và tag
    - Verify format: `<account>.dkr.ecr.<region>.amazonaws.com/<repo>:<tag>`
    - **Validates: Requirements 1.5, 1.7**

  - [ ]* 1.2 Viết unit tests cho script logic
    - Test arg parsing với valid/invalid arguments
    - Test error handling khi AWS credentials fail (mock `aws sts`)
    - Test dual-tag logic (tag != "latest" → 2 pushes; tag == "latest" → 1 push)
    - Test set -euo pipefail: mock một docker command để fail, verify script exit ngay
    - _Requirements: 1.6, 1.8, 1.9_

- [ ] 2. Tạo file `terraform/terraform.tfvars` từ example và điền ECR URIs

  - [ ] 2.1 Copy terraform.tfvars.example sang terraform.tfvars
    - Chạy: `cp terraform/terraform.tfvars.example terraform/terraform.tfvars`
    - Điền `account_id`, `aws_region`, `environment`, `domain_name`, `alert_email`
    - _Requirements: 2.3_

  - [ ] 2.2 Cập nhật ECR image URIs trong terraform.tfvars
    - Lấy ECR URIs từ output của `deploy-ecr.sh`
    - Đặt `core_backend_image = "<account>.dkr.ecr.<region>.amazonaws.com/antigroup-core:<tag>"`
    - Đặt `realtime_backend_image = "<account>.dkr.ecr.<region>.amazonaws.com/antigroup-realtime:<tag>"`
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ]* 2.3 Viết property test cho Terraform image variable round-trip
    - **Property 2: Terraform Image Variable Round-Trip**
    - Dùng `terraform plan -out` với nhiều URI values khác nhau, parse plan JSON output
    - Verify `container_definitions[0].image` trong planned task definition khớp đúng với input URI
    - Test với: URI có tag version (v1.0.0), URI với SHA tag, URI với "latest" tag
    - **Validates: Requirements 2.1, 2.2, 2.4**

- [ ] 3. Checkpoint – Kiểm tra cấu hình Terraform
  - Chạy `cd terraform && terraform init` và verify exit code 0
  - Chạy `terraform validate` và verify "The configuration is valid"
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 4.1, 4.2_

- [ ] 4. Chạy Terraform plan và review

  - [ ] 4.1 Thực thi terraform plan
    - Chạy: `terraform plan -var-file="terraform.tfvars" -out=tfplan`
    - Xem xét kỹ output: kiểm tra resources sẽ được tạo (VPC, subnets, ALB, ECS cluster, task definitions, RDS, ElastiCache)
    - Xác nhận `core_backend_image` và `realtime_backend_image` xuất hiện đúng trong planned ECS task definitions
    - _Requirements: 4.3_

  - [ ]* 4.2 Viết property test cho ECS Task Definition resource specs
    - **Property 3: ECS Task Definition Resource Specs Invariant**
    - Parse `terraform show -json tfplan`, extract task_definition resources
    - Verify `core-backend`: cpu=512, memory=1024, containerPort=3000
    - Verify `realtime-backend`: cpu=1024, memory=2048, containerPort=4000
    - Test với các environment values: dev, staging, prod
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 4.3 Viết property test kiểm tra no secrets hardcoded
    - **Property 4: No Secrets Hardcoded in Task Definitions**
    - Parse `terraform show -json tfplan`, extract container_definitions JSON
    - Verify rằng với bất kỳ task definition nào: DB_PASSWORD, JWT_SECRET, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN phải xuất hiện trong array `secrets` (với `valueFrom`), KHÔNG xuất hiện trong array `environment`
    - **Validates: Requirements 5.6**

- [ ] 5. Thực thi terraform apply

  - [ ] 5.1 Apply Terraform plan
    - Chạy: `terraform apply tfplan`
    - Theo dõi progress: Secrets → VPC → Security Groups → S3 → IAM → RDS → ElastiCache → ALB → ECS
    - Ghi lại thời gian tạo từng module lớn (RDS và ElastiCache thường mất 10-15 phút)
    - _Requirements: 4.4_

  - [ ] 5.2 Verify terraform outputs
    - Chạy: `terraform output`
    - Verify các output keys bắt buộc tồn tại: `alb_dns_name`, `ecs_cluster_name`, `core_backend_service_name`, `realtime_backend_service_name`, `core_backend_ecr_url`, `realtime_backend_ecr_url`
    - Lưu `alb_dns_name` để trỏ DNS
    - _Requirements: 4.5_

  - [ ]* 5.3 Viết property test cho Terraform outputs completeness
    - **Property 5: Terraform Outputs Completeness**
    - Parse `terraform output -json`, verify tất cả required output keys tồn tại
    - Test idempotency: chạy `terraform apply` lần 2, verify "No changes. Your infrastructure matches the configuration."
    - **Validates: Requirements 4.5**

- [ ] 6. Checkpoint – Xác nhận sau triển khai
  - Chạy health check: `curl -f "https://<alb_dns_name>/api/health"` → HTTP 200
  - Chạy health check: `curl -f "https://<alb_dns_name>/ws/health"` → HTTP 200
  - Verify ECS services đang chạy: `aws ecs describe-services --cluster <cluster> --services <core-svc> <rt-svc>`
  - Verify CloudWatch log groups `/ecs/core-backend` và `/ecs/realtime-backend` đã có logs
  - Trỏ DNS domain → `alb_dns_name` qua Route 53 hoặc DNS provider
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 3.1, 3.2, 4.4, 5.3, 5.5_

## Notes

- Tasks đánh dấu `*` là optional và có thể bỏ qua để MVP nhanh hơn
- ECR repos `antigroup-*` (tạo trong script) độc lập với Terraform-managed repos `core-backend`/`realtime-backend` — chỉ cần URI đúng trong `terraform.tfvars`
- Frontend (`antigroup-frontend`) hiện không có biến Terraform riêng trong codebase; deploy thủ công ECS service hoặc thêm vào module ECS nếu cần
- RDS và ElastiCache thường mất 10-20 phút để khởi tạo trong `terraform apply`
- Sau lần apply đầu, các lần sau chỉ update changed resources (Terraform idempotent)
- Property tests sử dụng `bats-core` cho Bash scripts và `terraform show -json` cho HCL validation

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3"] },
    { "wave": 4, "tasks": ["4"] },
    { "wave": 5, "tasks": ["5"] },
    { "wave": 6, "tasks": ["6"] }
  ]
}
```

Mỗi task phụ thuộc vào task trước — không thể chạy `terraform plan` trước khi có ECR URIs, và không thể verify health endpoints trước khi `terraform apply` hoàn thành.
