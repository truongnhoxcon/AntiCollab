# Requirements Document

## Introduction

Tài liệu này định nghĩa các yêu cầu chức năng và phi chức năng cho việc triển khai hệ thống Real-time Chat Collaboration lên AWS Cloud. Hệ thống bao gồm ba service Docker (Frontend Nginx, Core Backend Node.js, Realtime Backend Node.js/Socket.IO) được đóng gói đẩy lên Amazon ECR, sau đó được triển khai trên ECS Fargate qua Terraform.

## Glossary

- **ECR**: Amazon Elastic Container Registry — registry lưu trữ Docker images.
- **ECS_Fargate**: Amazon Elastic Container Service chạy trên Fargate (serverless compute).
- **ALB**: Application Load Balancer — cân bằng tải và định tuyến HTTPS/WebSocket.
- **Deploy_Script**: Script Bash `deploy-ecr.sh` tự động hoá quá trình build và push images.
- **Terraform**: Công cụ Infrastructure-as-Code quản lý toàn bộ hạ tầng AWS.
- **Core_Backend**: Service Node.js REST API chạy trên port 3000.
- **Realtime_Backend**: Service Node.js WebSocket/Socket.IO chạy trên port 4000.
- **Frontend**: Ứng dụng React được serve qua Nginx trên port 80.
- **Target_Group**: Nhóm targets trong ALB nhận traffic được forward từ listener rules.
- **Task_Definition**: Đặc tả container trong ECS (image, port, CPU, memory, env vars, secrets).

---

## Requirements

### Requirement 1: Build và Push Docker Images lên ECR

**User Story:** Là một DevOps engineer, tôi muốn có script tự động hoá việc build và push Docker images lên ECR, để tôi có thể triển khai nhất quán mà không cần thao tác thủ công dễ gây lỗi.

#### Acceptance Criteria

1. WHEN `deploy-ecr.sh` được thực thi với tham số `--account` và `--region`, THE Deploy_Script SHALL build Docker image cho `antigroup-frontend` từ context `apps/frontend` với platform `linux/amd64`.
2. WHEN `deploy-ecr.sh` được thực thi, THE Deploy_Script SHALL build Docker image cho `antigroup-core` từ context `apps/backend-core` với platform `linux/amd64`.
3. WHEN `deploy-ecr.sh` được thực thi, THE Deploy_Script SHALL build Docker image cho `antigroup-realtime` từ context `apps/backend-realtime` với platform `linux/amd64`.
4. WHEN một ECR repository chưa tồn tại, THE Deploy_Script SHALL tạo repository đó qua AWS CLI trước khi push.
5. WHEN Docker images được build thành công, THE Deploy_Script SHALL push lên đúng ECR repository tương ứng với tag được chỉ định qua `--tag` (mặc định: `latest`).
6. WHEN tham số `--tag` khác `latest`, THE Deploy_Script SHALL push cả tag được chỉ định lẫn tag `latest` cho mỗi image.
7. WHEN quá trình push hoàn tất, THE Deploy_Script SHALL in ra ECR URIs của `antigroup-core` và `antigroup-realtime` kèm hướng dẫn cập nhật `terraform.tfvars`.
8. IF AWS credentials không hợp lệ hoặc không thể kết nối, THEN THE Deploy_Script SHALL dừng thực thi và in thông báo lỗi mô tả rõ nguyên nhân.
9. IF bất kỳ bước build hoặc push nào thất bại, THEN THE Deploy_Script SHALL dừng ngay lập tức (`set -euo pipefail`) và không tiếp tục các bước tiếp theo.

---

### Requirement 2: Cấu Hình Terraform Variables cho ECR

**User Story:** Là một DevOps engineer, tôi muốn biết chính xác cần cập nhật giá trị nào trong `terraform.tfvars`, để Terraform có thể pull đúng Docker images từ ECR khi deploy ECS services.

#### Acceptance Criteria

1. THE Terraform SHALL sử dụng biến `core_backend_image` để chỉ định ECR URI cho ECS Task Definition của Core_Backend.
2. THE Terraform SHALL sử dụng biến `realtime_backend_image` để chỉ định ECR URI cho ECS Task Definition của Realtime_Backend.
3. WHEN `terraform.tfvars` được tạo từ `terraform.tfvars.example`, THE file SHALL chứa đầy đủ các biến bắt buộc: `aws_region`, `environment`, `project_name`, `account_id`, `vpc_cidr`, `core_backend_image`, `realtime_backend_image`, `domain_name`, `alert_email`.
4. WHEN giá trị `core_backend_image` hoặc `realtime_backend_image` được cập nhật trong `terraform.tfvars`, THE ECS_Fargate Task_Definition tương ứng SHALL tham chiếu đúng URI đó trong field `image`.
5. IF `core_backend_image` hoặc `realtime_backend_image` để trống (empty string), THEN THE Terraform SHALL vẫn thực hiện `plan` thành công nhưng ECS service sẽ dùng placeholder image.

---

### Requirement 3: Định Tuyến ALB

**User Story:** Là một người dùng cuối, tôi muốn có một entry point duy nhất qua HTTPS để truy cập cả REST API và WebSocket, để tôi không cần nhớ nhiều địa chỉ khác nhau.

#### Acceptance Criteria

1. WHEN ALB nhận HTTP request với path bắt đầu bằng `/api/*`, THE ALB SHALL forward request đó tới Target_Group `core-backend-tg` (port 3000).
2. WHEN ALB nhận HTTP request với path bắt đầu bằng `/ws/*`, THE ALB SHALL forward request đó tới Target_Group `realtime-backend-tg` (port 4000) với sticky session.
3. WHILE một WebSocket client giữ kết nối, THE ALB SHALL duy trì kết nối đó trong tối đa 3600 giây (`idle_timeout`).
4. THE ALB SHALL bật sticky session kiểu `lb_cookie` với thời gian 3600 giây trên Target_Group `realtime-backend-tg` để đảm bảo WebSocket client luôn được routing tới cùng một ECS task.
5. WHEN ALB nhận HTTP request trên port 80, THE ALB SHALL redirect sang HTTPS port 443 với mã trạng thái HTTP 301.
6. THE ALB SHALL sử dụng SSL policy `ELBSecurityPolicy-TLS13-1-2-2021-06` để enforce TLS 1.3.
7. IF request không khớp với bất kỳ listener rule nào, THEN THE ALB SHALL trả về HTTP 404 với nội dung "Not Found".

---

### Requirement 4: Triển Khai Hạ Tầng bằng Terraform

**User Story:** Là một DevOps engineer, tôi muốn triển khai toàn bộ hạ tầng AWS bằng một chuỗi lệnh Terraform nhất quán, để có thể tái tạo môi trường đúng và đủ trong mọi tình huống.

#### Acceptance Criteria

1. WHEN `terraform init` được thực thi trong thư mục `terraform/`, THE Terraform SHALL tải thành công tất cả providers (`hashicorp/aws ~> 5.0`) và khởi tạo các local modules (vpc, security-groups, alb, ecs, rds, elasticache, s3, iam, secrets).
2. WHEN `terraform validate` được thực thi, THE Terraform SHALL báo cáo cấu hình hợp lệ mà không có lỗi syntax.
3. WHEN `terraform plan -var-file=terraform.tfvars` được thực thi với `terraform.tfvars` đầy đủ, THE Terraform SHALL tạo execution plan liệt kê toàn bộ resources sẽ được tạo mà không có lỗi.
4. WHEN `terraform apply` được thực thi theo plan đã tạo, THE Terraform SHALL tạo thành công toàn bộ resources theo thứ tự dependency: Secrets → VPC → Security Groups → S3 → IAM → RDS → ElastiCache → ALB → ECS.
5. WHEN `terraform apply` hoàn thành, THE Terraform SHALL xuất outputs bao gồm: `alb_dns_name`, `ecs_cluster_name`, `core_backend_service_name`, `realtime_backend_service_name`, `core_backend_ecr_url`, `realtime_backend_ecr_url`.
6. IF `terraform apply` thất bại ở một module, THEN THE Terraform SHALL hiển thị thông báo lỗi chi tiết và cho phép chạy lại (`terraform apply` là idempotent).

---

### Requirement 5: ECS Fargate Service Configuration

**User Story:** Là một system administrator, tôi muốn các ECS services chạy ổn định với health check và logging, để tôi có thể phát hiện và khắc phục sự cố nhanh chóng.

#### Acceptance Criteria

1. THE ECS_Fargate Task_Definition cho Core_Backend SHALL cấu hình container port 3000, CPU 512, memory 1024 MB.
2. THE ECS_Fargate Task_Definition cho Realtime_Backend SHALL cấu hình container port 4000, CPU 1024, memory 2048 MB.
3. WHEN một ECS container khởi động, THE ECS_Fargate SHALL thực hiện health check tại `GET /health` mỗi 30 giây, với timeout 5 giây, sau `startPeriod` 60 giây.
4. WHEN một ECS container không pass health check sau 3 lần liên tiếp, THE ECS_Fargate SHALL đánh dấu task là unhealthy và thay thế bằng task mới.
5. THE ECS_Fargate SHALL ghi logs container vào CloudWatch log groups `/ecs/core-backend` và `/ecs/realtime-backend` tương ứng.
6. THE ECS_Fargate Task_Definition SHALL inject secrets (DB_PASSWORD, JWT_SECRET, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) từ AWS Secrets Manager vào container environment, không hardcode trong task definition.
