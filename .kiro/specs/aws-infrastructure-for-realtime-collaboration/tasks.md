# Implementation Plan: AWS Infrastructure MVP - Real-time Streaming & Collaboration Platform

## Overview

Kế hoạch triển khai hạ tầng AWS theo kiến trúc IaC (Terraform) cho nền tảng Real-time Streaming & Collaboration. Các task được tổ chức tuần tự từ foundation đến application layer, đảm bảo mỗi bước build trên bước trước và kết thúc bằng wiring toàn bộ hệ thống.

Stack: Terraform + ECS Fargate + RDS PostgreSQL + ElastiCache Redis + ALB + S3 + Twilio STUN/TURN + GitHub Actions + CloudWatch.

## Tasks

- [x] 1. Terraform Foundation - Backend State và Provider Configuration
  - [x] 1.1 Khởi tạo cấu trúc thư mục Terraform và cấu hình backend S3
    - Tạo thư mục `terraform/` với cấu trúc: `main.tf`, `variables.tf`, `outputs.tf`, `backend.tf`, `terraform.tfvars.example`
    - Tạo thư mục `terraform/modules/` với các subfolder: `vpc/`, `ecs/`, `alb/`, `rds/`, `elasticache/`, `s3/`, `iam/`, `security-groups/`, `secrets/`
    - Tạo thư mục `terraform/environments/` với files: `dev.tfvars`, `staging.tfvars`, `prod.tfvars`
    - Viết `backend.tf`: cấu hình Terraform remote state sử dụng S3 bucket và DynamoDB table cho state locking
    - Viết `main.tf` root: khai báo required providers (AWS ~> 5.0), terraform required_version (~> 1.6), và AWS provider với region variable
    - Viết `variables.tf` root: định nghĩa variables `aws_region`, `environment`, `project_name`, `vpc_cidr`, image URIs cho từng service
    - Viết `outputs.tf` root: định nghĩa outputs cho ALB DNS, ECS cluster name, RDS endpoint, Redis endpoint
    - _Requirements: 19.1, 19.2, 19.9_

  - [ ]* 1.2 Viết script kiểm tra Terraform validation và fmt
    - Tạo `infra/scripts/validate-terraform.sh`: chạy `terraform fmt -check -recursive` và `terraform validate`
    - _Requirements: 19.1_

- [x] 2. Networking - VPC, Subnets, Internet Gateway, NAT Gateway, Route Tables
  - [x] 2.1 Tạo Terraform module VPC với subnets và internet connectivity
    - Viết `terraform/modules/vpc/main.tf`: tạo `aws_vpc` với CIDR `10.0.0.0/16`, DNS hostnames và DNS resolution enabled
    - Tạo 2 `aws_subnet` public (10.0.1.0/24 tại us-east-1a, 10.0.2.0/24 tại us-east-1b) với `map_public_ip_on_launch = true`
    - Tạo 2 `aws_subnet` private (10.0.10.0/24 tại us-east-1a, 10.0.11.0/24 tại us-east-1b)
    - Tạo `aws_internet_gateway` attach vào VPC
    - Tạo `aws_eip` và `aws_nat_gateway` tại PublicSubnet1 (us-east-1a)
    - Tạo `aws_route_table` public với route `0.0.0.0/0 → Internet Gateway`; associate với cả 2 public subnets
    - Tạo `aws_route_table` private với route `0.0.0.0/0 → NAT Gateway`; associate với cả 2 private subnets
    - Viết `terraform/modules/vpc/variables.tf` và `terraform/modules/vpc/outputs.tf` (output: vpc_id, public_subnet_ids, private_subnet_ids)
    - Enable VPC Flow Logs (`aws_flow_log`) với destination CloudWatch Logs
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 16.6_

- [x] 3. Security Groups
  - [x] 3.1 Tạo Terraform module security-groups cho tất cả services
    - Viết `terraform/modules/security-groups/main.tf`
    - Tạo `aws_security_group` **alb-sg**: inbound 443 từ `0.0.0.0/0`, inbound 80 từ `0.0.0.0/0`; outbound port 3000 đến core-backend-sg, port 4000 đến realtime-backend-sg
    - Tạo `aws_security_group` **core-backend-sg**: inbound port 3000 từ alb-sg; outbound port 5432 đến rds-sg, port 6379 đến redis-sg, port 443 ra internet (HTTPS cho AWS APIs và Twilio)
    - Tạo `aws_security_group` **realtime-backend-sg**: inbound port 4000 từ alb-sg; outbound port 5432 đến rds-sg, port 6379 đến redis-sg, port 443 ra internet
    - Tạo `aws_security_group` **rds-sg**: inbound port 5432 từ core-backend-sg và realtime-backend-sg; không có outbound
    - Tạo `aws_security_group` **redis-sg**: inbound port 6379 từ core-backend-sg và realtime-backend-sg; không có outbound
    - Viết `variables.tf` (nhận vpc_id) và `outputs.tf` (export tất cả security group IDs)
    - _Requirements: 2.8, 2.9, 2.10, 16.4, 16.5_

- [x] 4. IAM Roles và Policies
  - [x] 4.1 Tạo Terraform module IAM cho ECS Task Execution Role và ECS Task Role
    - Viết `terraform/modules/iam/main.tf`
    - Tạo `aws_iam_role` **ecsTaskExecutionRole** với trust policy cho `ecs-tasks.amazonaws.com`
    - Attach policy cho ecsTaskExecutionRole: ECR pull permissions (`ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage`), CloudWatch Logs (`logs:CreateLogStream`, `logs:PutLogEvents` scoped tới `/ecs/*`), Secrets Manager GetSecretValue scoped tới ARNs của db-password, jwt-secret, twilio/api-credentials, redis-auth-token
    - Tạo `aws_iam_role` **ecsTaskRole** với trust policy cho `ecs-tasks.amazonaws.com`
    - Attach policy cho ecsTaskRole: S3 permissions (`s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket`) scoped tới bucket ARN cụ thể; Secrets Manager GetSecretValue scoped tới `twilio/*`
    - Viết `variables.tf` (nhận s3_bucket_arn, secret ARNs) và `outputs.tf` (export role ARNs)
    - _Requirements: 12.6, 12.7, 12.8, 16.5_

- [x] 5. Secrets Manager
  - [x] 5.1 Tạo Terraform module secrets cho AWS Secrets Manager
    - Viết `terraform/modules/secrets/main.tf`
    - Tạo `aws_secretsmanager_secret` **db-password** với description và recovery_window_in_days = 7; tạo `aws_secretsmanager_secret_version` với placeholder JSON `{"username":"postgres","password":"CHANGE_ME"}`
    - Tạo `aws_secretsmanager_secret` **jwt-secret** với placeholder `{"secret":"CHANGE_ME"}`
    - Tạo `aws_secretsmanager_secret` **twilio/api-credentials** với placeholder JSON cho accountSid, authToken, apiKeySid, apiKeySecret
    - Tạo `aws_secretsmanager_secret` **redis-auth-token** với placeholder `{"token":"CHANGE_ME"}`
    - Tạo `aws_secretsmanager_secret_rotation` cho db-password với rotation schedule 90 ngày (sử dụng AWS managed rotation Lambda)
    - Viết `outputs.tf` (export tất cả secret ARNs và names)
    - _Requirements: 8.7, 16.7, 16.8, 16.9_

- [x] 6. Amazon ECR - Container Registries
  - [x] 6.1 Tạo ECR repositories cho core-backend và realtime-backend
    - Viết `terraform/modules/ecs/ecr.tf` (hoặc thêm vào module ecs)
    - Tạo `aws_ecr_repository` **core-backend** với `image_tag_mutability = "MUTABLE"` và `scan_on_push = true`
    - Tạo `aws_ecr_repository` **realtime-backend** với `image_tag_mutability = "MUTABLE"` và `scan_on_push = true`
    - Tạo `aws_ecr_lifecycle_policy` cho cả 2 repos: giữ lại 30 images gần nhất, xóa untagged images sau 1 ngày
    - Output ECR repository URLs để dùng trong GitHub Actions và ECS task definitions
    - _Requirements: 18.3_

- [x] 7. RDS PostgreSQL
  - [x] 7.1 Tạo Terraform module RDS PostgreSQL Single-AZ
    - Viết `terraform/modules/rds/main.tf`
    - Tạo `aws_db_subnet_group` sử dụng private subnet IDs
    - Tạo `aws_db_instance` với: engine `postgres`, engine_version `15`, instance_class `db.t3.medium`, allocated_storage 100, storage_type `gp3`, storage_encrypted = true, db_name `realtime_collab`, username `postgres`
    - Cấu hình: multi_az = false (Single-AZ), backup_retention_period = 7, backup_window `03:00-04:00`, maintenance_window `Sun:04:00-Sun:05:00`, deletion_protection = true
    - Enable: performance_insights_enabled = true, monitoring_interval = 60 (Enhanced Monitoring), enabled_cloudwatch_logs_exports = `["postgresql"]`
    - Cấu hình security_group = rds-sg, db_subnet_group_name từ resource trên
    - Lấy password từ Secrets Manager (không hardcode): sử dụng `data "aws_secretsmanager_secret_version"` trong module
    - Tạo `aws_db_parameter_group` với `ssl = on` để enforce SSL connections
    - Viết `variables.tf` và `outputs.tf` (output: db_endpoint, db_port, db_name)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2_

- [x] 8. ElastiCache Redis
  - [x] 8.1 Tạo Terraform module ElastiCache Redis Single-AZ
    - Viết `terraform/modules/elasticache/main.tf`
    - Tạo `aws_elasticache_subnet_group` sử dụng private subnet IDs
    - Tạo `aws_elasticache_replication_group` với: engine `redis`, engine_version `7.x`, node_type `cache.t3.medium`, num_cache_clusters = 1 (Single-AZ, no replicas)
    - Cấu hình bảo mật: transit_encryption_enabled = true, at_rest_encryption_enabled = true, auth_token lấy từ Secrets Manager
    - Cấu hình: automatic_failover_enabled = false (Single-AZ), multi_az_enabled = false, subnet_group_name từ resource trên, security_group_ids = [redis-sg]
    - Cấu hình backup: snapshot_retention_limit = 1, snapshot_window `03:00-04:00`, maintenance_window `sun:04:00-sun:05:00`
    - Enable: auto_minor_version_upgrade = true, notification_topic_arn (SNS)
    - Viết `variables.tf` và `outputs.tf` (output: redis_endpoint, redis_port)
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.7_

- [x] 9. S3 Buckets
  - [x] 9.1 Tạo Terraform module S3 cho file storage và logs bucket
    - Viết `terraform/modules/s3/main.tf`
    - Tạo `aws_s3_bucket` **realtime-collab-files-{account-id}**: versioning enabled, server-side encryption SSE-S3 (AES256)
    - Tạo `aws_s3_bucket_public_access_block` cho file bucket: tất cả block_public settings = true
    - Tạo `aws_s3_bucket_cors_configuration`: AllowedOrigins sử dụng variable `app_domain`, AllowedMethods [GET, PUT, POST, DELETE], AllowedHeaders ["*"], MaxAgeSeconds 3600
    - Tạo `aws_s3_bucket_lifecycle_configuration`: rule 1 - transition files có prefix `workspace-` sang GLACIER sau 90 ngày; rule 2 - abort incomplete multipart uploads sau 7 ngày
    - Tạo `aws_s3_bucket_policy` để enforce SSL (deny HTTP uploads)
    - Tạo `aws_s3_bucket` **realtime-collab-alb-logs** và **realtime-collab-access-logs**: server-side encryption, versioning
    - Enable server access logging cho file bucket → logs bucket
    - Viết `variables.tf` (app_domain, account_id) và `outputs.tf` (bucket name, bucket ARN)
    - _Requirements: 6.1, 6.2, 6.5, 6.6, 6.7, 6.8, 13.8_

- [x] 10. Application Load Balancer
  - [x] 10.1 Tạo Terraform module ALB với listeners, target groups và routing rules
    - Viết `terraform/modules/alb/main.tf`
    - Tạo `aws_lb` internet-facing, ip address type ipv4, subnets = public_subnet_ids, security_groups = [alb-sg]; enable access_logs → alb-logs bucket; idle_timeout = 3600 giây (hỗ trợ WebSocket), enable_deletion_protection = true
    - Tạo `aws_lb_target_group` **core-backend-tg**: protocol HTTP, port 3000, target_type ip, health_check path `/health` interval 15s timeout 5s healthy_threshold 2 unhealthy_threshold 2, deregistration_delay = 30
    - Tạo `aws_lb_target_group` **realtime-backend-tg**: protocol HTTP, port 4000, target_type ip, health_check path `/health` interval 15s timeout 5s healthy_threshold 2 unhealthy_threshold 2, deregistration_delay = 60; enable stickiness type `lb_cookie` duration 3600 giây
    - Tạo `aws_lb_listener` HTTPS port 443: default action fixed-response 404; sử dụng `aws_acm_certificate` (data source tham chiếu đến cert đã có hoặc tạo `aws_acm_certificate` mới với DNS validation)
    - Tạo `aws_lb_listener` HTTP port 80: default action redirect sang HTTPS 443
    - Tạo `aws_lb_listener_rule` priority 1: condition path_pattern `/api/*` → forward core-backend-tg
    - Tạo `aws_lb_listener_rule` priority 2: condition path_pattern `/ws/*` → forward realtime-backend-tg
    - Viết `variables.tf` (vpc_id, public_subnet_ids, alb_sg_id, domain_name) và `outputs.tf` (alb_arn, alb_dns_name, target group ARNs, listener ARNs)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 16.3_

- [x] 11. ECS Cluster và Services
  - [x] 11.1 Tạo ECS Cluster và task definitions
    - Viết `terraform/modules/ecs/cluster.tf`
    - Tạo `aws_ecs_cluster` với tên `realtime-collab-cluster`, enable Container Insights
    - Tạo `aws_ecs_cluster_capacity_providers`: FARGATE và FARGATE_SPOT
    - Viết `terraform/modules/ecs/task-definitions.tf`
    - Tạo `aws_ecs_task_definition` **core-backend-task**: networkMode awsvpc, CPU 512, memory 1024, requiresCompatibilities FARGATE; container definition với image từ ECR, port 3000, environment variables (NODE_ENV, DB_HOST, REDIS_HOST), secrets từ Secrets Manager (DB_PASSWORD, JWT_SECRET, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN), health check `curl -f http://localhost:3000/health`, logConfiguration awslogs với log group `/ecs/core-backend`
    - Tạo `aws_ecs_task_definition` **realtime-backend-task**: networkMode awsvpc, CPU 1024, memory 2048, requiresCompatibilities FARGATE; container definition với image từ ECR, port 4000, environment variables, secrets tương tự, health check port 4000, logConfiguration awslogs `/ecs/realtime-backend`
    - _Requirements: 1.1, 1.2, 1.5, 13.1, 13.2_

  - [x] 11.2 Tạo ECS Services với auto-scaling
    - Viết `terraform/modules/ecs/services.tf`
    - Tạo `aws_ecs_service` **core-backend-service**: cluster, task_definition, desired_count = 2, launch_type FARGATE; network_configuration với private_subnets và core-backend-sg; load_balancer config → core-backend-tg container_port 3000; deployment_minimum_healthy_percent = 100, deployment_maximum_percent = 200; enable_ecs_managed_tags = true
    - Tạo `aws_ecs_service` **realtime-backend-service**: tương tự, desired_count = 2, subnets private, realtime-backend-sg, → realtime-backend-tg container_port 4000
    - Tạo `aws_appautoscaling_target` cho cả 2 services: min_capacity = 2
    - Tạo `aws_appautoscaling_policy` **core-backend**: TargetTrackingScaling, ECSServiceAverageCPUUtilization target_value 70, scale_out_cooldown 60, scale_in_cooldown 300, max_capacity 10
    - Tạo `aws_appautoscaling_policy` **realtime-backend**: TargetTrackingScaling, ECSServiceAverageCPUUtilization target_value 60, scale_out_cooldown 60, scale_in_cooldown 300, max_capacity 20
    - _Requirements: 1.3, 1.4, 1.6, 1.7, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [x] 12. CloudWatch Monitoring - Log Groups, Dashboards, Alarms, SNS
  - [x] 12.1 Tạo CloudWatch log groups, SNS topic và alarms
    - Viết `terraform/modules/ecs/monitoring.tf` (hoặc tạo module riêng `cloudwatch/`)
    - Tạo `aws_cloudwatch_log_group` **/ecs/core-backend**: retention_in_days = 30
    - Tạo `aws_cloudwatch_log_group` **/ecs/realtime-backend**: retention_in_days = 30
    - Tạo `aws_cloudwatch_log_group` **/aws/rds/realtime-collab-db/postgresql**: retention_in_days = 7
    - Tạo `aws_sns_topic` **realtime-collab-alerts** và `aws_sns_topic_subscription` (email protocol với địa chỉ email từ variable)
    - Tạo các `aws_cloudwatch_metric_alarm` Critical:
      - **ECS-HighCPU**: CPUUtilization > 80% trong 5 phút → SNS
      - **ECS-CoreServiceDown**: RunningTaskCount < 1 trong 1 phút → SNS
      - **ECS-RealtimeServiceDown**: RunningTaskCount < 1 trong 1 phút → SNS
      - **ALB-HighErrorRate**: HTTPCode_Target_5XX_Count > 1% trong 2 phút → SNS
      - **RDS-HighCPU**: CPUUtilization > 85% trong 10 phút → SNS
      - **RDS-LowStorage**: FreeStorageSpace < 10GB trong 5 phút → SNS
      - **Redis-HighMemory**: DatabaseMemoryUsagePercentage > 90% trong 5 phút → SNS
      - **Redis-HighConnections**: CurrConnections > 9000 trong 5 phút → SNS
    - Tạo `aws_cloudwatch_metric_alarm` Warning:
      - **ALB-HighLatency**: TargetResponseTime p95 > 500ms trong 5 phút → SNS
      - **RDS-HighConnections**: DatabaseConnections > 800 trong 5 phút → SNS
    - Tạo `aws_cloudwatch_dashboard` **RealTime-Collaboration-Overview** với widgets cho ECS metrics, ALB metrics, RDS metrics, Redis metrics
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.9_

- [x] 13. Wiring tất cả modules trong root main.tf
  - [x] 13.1 Kết nối tất cả Terraform modules trong root configuration
    - Cập nhật `terraform/main.tf` root để gọi tất cả modules theo thứ tự dependency:
      1. Module `secrets` (không có dependency)
      2. Module `vpc` (không có dependency)
      3. Module `security-groups` (nhận vpc_id từ vpc module)
      4. Module `iam` (nhận s3_bucket_arn từ s3 module - sử dụng local hoặc depends_on)
      5. Module `s3` (không có dependency ngoài variables)
      6. Module `rds` (nhận private_subnet_ids, rds_sg_id, db_password_secret_arn)
      7. Module `elasticache` (nhận private_subnet_ids, redis_sg_id, redis_auth_secret_arn)
      8. Module `alb` (nhận public_subnet_ids, alb_sg_id, vpc_id, domain_name)
      9. Module `ecs` (nhận tất cả outputs từ các modules trên)
    - Cập nhật `terraform/outputs.tf` root với các outputs quan trọng cho CI/CD: ECR URLs, ALB DNS name, ECS cluster name, service names
    - Viết `terraform/environments/prod.tfvars`, `staging.tfvars`, `dev.tfvars` với giá trị cụ thể cho từng environment (instance types, domain names, alert emails)
    - _Requirements: 14.4, 19.1, 19.9_

- [ ] 14. CI/CD Pipeline - GitHub Actions Workflows
  - [ ] 14.1 Tạo GitHub Actions workflow cho build và push images lên ECR
    - Tạo `.github/workflows/build-and-push.yml`
    - Trigger: push to `main` branch
    - Jobs:
      - **build-core-backend**: checkout code, configure AWS credentials (OIDC), login ECR, build Docker image từ `apps/backend-core/Dockerfile`, tag với commit SHA, push lên ECR core-backend repository
      - **build-realtime-backend**: tương tự với `apps/backend-realtime/Dockerfile` và ECR realtime-backend repository
    - Sử dụng GitHub Actions OIDC với IAM role (không dùng long-lived credentials); tạo `aws_iam_openid_connect_provider` và IAM role cho GitHub Actions trong module iam
    - _Requirements: 18.2, 18.3_

  - [ ] 14.2 Tạo GitHub Actions workflow cho deploy lên ECS
    - Tạo `.github/workflows/deploy.yml`
    - Trigger: sau khi build-and-push workflow thành công, hoặc manual workflow_dispatch
    - Jobs:
      - **deploy-staging**: cập nhật ECS task definition với image mới (sử dụng `aws-actions/amazon-ecs-render-task-definition` và `aws-actions/amazon-ecs-deploy-task-definition`), chờ service stable, chạy smoke tests
      - **deploy-production**: requires manual approval (`environment: production`), deploy tương tự staging, chạy smoke tests
    - Workflow thực hiện rolling update: minimum_healthy_percent 100, maximum_percent 200 (đã cấu hình trong Terraform)
    - Nếu deploy thất bại (task không healthy), ECS tự động rollback (deployment circuit breaker)
    - _Requirements: 18.3, 18.4, 18.5, 18.6, 18.7, 18.9, 18.10_

  - [ ]* 14.3 Viết GitHub Actions workflow cho Terraform CI checks
    - Tạo `.github/workflows/terraform-checks.yml`
    - Trigger: pull request affecting `terraform/**`
    - Jobs: `terraform fmt -check`, `terraform validate`, `tflint`, `checkov -d terraform/` cho policy/security scan
    - Comment terraform plan output lên Pull Request để review
    - _Requirements: 18.2, 19.1_

- [ ] 15. Smoke Tests - Post-deployment Validation Scripts
  - [ ] 15.1 Viết smoke test scripts cho post-deployment validation
    - Tạo `infra/scripts/smoke-tests.sh`: bash script nhận ALB_DNS_NAME làm argument
    - Test 1 - ALB Health: `curl -f https://${ALB_DNS}/health` expect 200 OK trong 5 giây
    - Test 2 - Core Backend API: `curl -f https://${ALB_DNS}/api/health` expect JSON response
    - Test 3 - WebSocket endpoint: dùng `wscat` hoặc `curl` với Upgrade header để kiểm tra `/ws/health`
    - Test 4 - SSL Certificate: `openssl s_client -connect ${ALB_DNS}:443` check certificate validity và expiry
    - Test 5 - HTTP→HTTPS Redirect: `curl -I http://${ALB_DNS}` expect 301/302 redirect
    - Tạo `infra/scripts/check-ecs-health.sh`: dùng AWS CLI để kiểm tra `aws ecs describe-services` có runningCount >= desiredCount cho cả 2 services
    - Tạo `infra/scripts/check-rds-connectivity.sh`: chạy trong ECS task để kiểm tra connectivity tới RDS
    - _Requirements: 13.1, 15.7, 18.5, 18.6_

- [ ] 16. Documentation
  - [ ] 16.1 Viết README và architecture documentation
    - Cập nhật `README.md` root với: Project overview, Prerequisites (Terraform >= 1.6, AWS CLI, GitHub Actions OIDC setup), Quick start guide (clone → configure tfvars → terraform init/plan/apply), Environment variables reference
    - Tạo `docs/architecture.md`: mô tả kiến trúc tổng thể, các luồng dữ liệu chính (messaging flow, WebRTC flow, file upload/download flow), giải thích các lựa chọn thiết kế (Single-AZ cho MVP, no CDN, Twilio STUN/TURN)
    - Tạo `docs/runbooks/deployment.md`: hướng dẫn deploy lần đầu (initial Terraform apply), deploy thông thường (GitHub Actions), rollback procedure
    - Tạo `docs/runbooks/disaster-recovery.md`: RTO/RPO documentation (RTO 4h, RPO 24h), RDS backup restoration steps, Point-in-Time Recovery procedure, S3 object recovery từ versioning, Complete environment recreation từ Terraform
    - Tạo `docs/runbooks/scaling.md`: manual scaling, auto-scaling thresholds, khi nào nên upgrade instance types
    - Tạo `docs/network-reference.md`: bảng liệt kê tất cả security group rules (ports, protocols, sources/destinations), IAM roles và permissions summary, external dependencies (Twilio endpoints, AWS services)
    - Tạo `docs/cost-estimation.md`: ước tính chi phí monthly cho MVP workload dựa trên instance types đã chọn
    - _Requirements: 14.5, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8_

- [ ] 17. Final Checkpoint - Kiểm tra toàn bộ infrastructure
  - Chạy `terraform validate` và `terraform fmt -check -recursive` để đảm bảo không có lỗi cú pháp
  - Chạy `terraform plan -var-file=environments/staging.tfvars` và review output - đảm bảo không có unintended changes
  - Kiểm tra tất cả module outputs được sử dụng đúng trong root `main.tf`
  - Đảm bảo tất cả security groups chỉ mở đúng ports theo thiết kế
  - Kiểm tra tất cả secrets được tham chiếu từ Secrets Manager, không có plaintext credentials nào trong code
  - Xác nhận GitHub Actions workflows sử dụng OIDC (không có long-lived AWS credentials)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks đánh dấu `*` là optional và có thể bỏ qua để tăng tốc MVP
- Các task được thiết kế theo kiến trúc IaC (Terraform) - không có property-based tests vì đây là declarative configuration, không phải imperative code
- Thay vào đó, validation được thực hiện qua: `terraform validate`, policy checks (Checkov/tfsec), smoke tests sau deployment
- Mỗi task tham chiếu đến requirements cụ thể để đảm bảo traceability
- Thứ tự task đã được tối ưu để minimize dependencies: foundation → networking → security → compute → monitoring → CI/CD
- Trước khi chạy `terraform apply` lần đầu, cần tạo S3 bucket và DynamoDB table cho Terraform backend thủ công (hoặc dùng script bootstrap)
- Terraform state nên được quản lý riêng cho từng environment (dev/staging/prod) bằng cách dùng Terraform workspaces hoặc separate state files

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["3.1", "4.1", "5.1"] },
    { "id": 3, "tasks": ["6.1", "7.1", "8.1", "9.1"] },
    { "id": 4, "tasks": ["10.1"] },
    { "id": 5, "tasks": ["11.1"] },
    { "id": 6, "tasks": ["11.2", "12.1"] },
    { "id": 7, "tasks": ["13.1"] },
    { "id": 8, "tasks": ["14.1", "14.2", "15.1"] },
    { "id": 9, "tasks": ["14.3", "16.1"] }
  ]
}
```
