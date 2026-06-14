# Requirements Document

## Introduction

Hệ thống Real-time Streaming & Collaboration là một nền tảng giao tiếp thời gian thực, hỗ trợ multi-tenant, yêu cầu độ trễ thấp và khả năng chịu tải cao. Hệ thống cung cấp các tính năng nhắn tin văn bản, gọi video/audio, chia sẻ file, và quản lý trạng thái hiện diện người dùng.

Tài liệu này định nghĩa các yêu cầu về hạ tầng AWS để triển khai hệ thống với các đặc tính phi chức năng: độ trễ thấp (low-latency < 100ms cho messaging, < 200ms cho WebRTC signaling), khả năng mở rộng (scalability), tính sẵn sàng cao (high availability >= 99.9%), và bảo mật (security).

## Glossary

- **Infrastructure**: Toàn bộ hạ tầng AWS bao gồm compute, networking, database, storage services
- **Container_Orchestrator**: Amazon ECS (Elastic Container Service) với AWS Fargate để quản lý Docker containers serverless
- **ECS_Service**: ECS service definition quản lý task instances và integrates với load balancer
- **ECS_Task**: Container instance chạy trong ECS, tương đương pod trong Kubernetes
- **Realtime_Backend**: Backend service xử lý WebSocket connections, WebRTC signaling, và pub/sub messaging
- **Core_Backend**: Backend service xử lý REST API, authentication, business logic
- **Frontend_App**: React application được phục vụ cho end-users
- **Cache_Layer**: Amazon ElastiCache for Redis Single-AZ để xử lý pub/sub và caching
- **Primary_Database**: Amazon RDS PostgreSQL Single-AZ để lưu trữ dữ liệu chính
- **File_Storage**: Amazon S3 để lưu trữ files và media
- **Load_Balancer**: Application Load Balancer để xử lý HTTP/HTTPS và WebSocket traffic
- **NAT_Gateway**: Service cho phép private subnets truy cập internet
- **VPC**: Virtual Private Cloud - mạng ảo độc lập trong AWS
- **Public_Subnet**: Subnet có route đến Internet Gateway, chứa các resources truy cập từ internet
- **Private_Subnet**: Subnet không có route trực tiếp đến Internet Gateway, chứa backend services
- **Twilio_STUN_TURN**: Twilio Network Traversal Service - SaaS STUN/TURN servers cho WebRTC NAT traversal
- **WebSocket_Connection**: Persistent bidirectional connection cho real-time messaging
- **Tenant**: Một workspace/organization độc lập trong hệ thống multi-tenant
- **Presence_Status**: Trạng thái online/offline/away của user
- **Message_Latency**: Thời gian từ khi user gửi message đến khi user khác nhận được
- **Signaling_Latency**: Thời gian xử lý WebRTC signaling messages (offer/answer/ICE candidates)
- **Auto_Scaling_Policy**: ECS service auto-scaling configuration dựa trên metrics
- **Security_Group**: Firewall rules cho AWS resources
- **IAM_Role**: Identity and Access Management role để quản lý permissions

## Requirements

### Requirement 1: Container Orchestration Platform

**User Story:** As a DevOps engineer, I want to deploy containerized services on a serverless container platform, so that I can leverage existing Docker containers without managing infrastructure and achieve fast MVP deployment.

#### Acceptance Criteria

1. THE Infrastructure SHALL provision Amazon ECS cluster with AWS Fargate launch type
2. THE Container_Orchestrator SHALL support Docker container deployment from existing Dockerfiles
3. THE Container_Orchestrator SHALL deploy ECS_Task instances across at least 2 availability zones
4. WHEN an ECS_Task fails health check, THE Container_Orchestrator SHALL automatically restart the task within 30 seconds
5. THE ECS_Service SHALL support task definition with CPU and memory resource allocations
6. THE Container_Orchestrator SHALL distribute tasks across multiple availability zones for high availability
7. THE ECS_Service SHALL integrate with Application Load Balancer for automatic target registration

### Requirement 2: Network Architecture and Routing

**User Story:** As a Cloud Architect, I want to design a secure multi-tier network architecture, so that backend services are isolated from direct internet access while enabling proper traffic routing.

#### Acceptance Criteria

1. THE Infrastructure SHALL create a VPC with CIDR block that supports at least 1000 IP addresses
2. THE VPC SHALL contain at least 2 Public_Subnet instances and 2 Private_Subnet instances across different availability zones
3. THE Public_Subnet SHALL host Load_Balancer instances and NAT_Gateway instances
4. THE Private_Subnet SHALL host ECS_Task instances, Cache_Layer instances, and Primary_Database instances
5. WHEN an ECS_Task in Private_Subnet needs internet access, THE NAT_Gateway SHALL route the traffic through Public_Subnet
6. THE Infrastructure SHALL configure route tables so that Private_Subnet traffic to internet flows through NAT_Gateway
7. THE Infrastructure SHALL configure route tables so that Public_Subnet traffic to internet flows through Internet Gateway
8. THE Security_Group SHALL allow inbound HTTPS (port 443) and HTTP (port 80) traffic to Load_Balancer from internet
9. THE Security_Group SHALL allow inbound traffic to ECS_Task only from Load_Balancer security group
10. THE Security_Group SHALL allow inbound traffic to Cache_Layer and Primary_Database only from ECS_Task security group

### Requirement 3: Load Balancing for Web Traffic and WebSocket

**User Story:** As a system architect, I want to distribute HTTP/HTTPS and WebSocket traffic across multiple backend instances, so that the system can handle high concurrent connections and remain available during instance failures.

#### Acceptance Criteria

1. THE Infrastructure SHALL provision a single Application Load Balancer in Public_Subnet
2. THE Load_Balancer SHALL support WebSocket connection upgrades for Realtime_Backend traffic
3. THE Load_Balancer SHALL enable sticky sessions (session affinity) for WebSocket connections with at least 1 hour duration
4. THE Load_Balancer SHALL route HTTP/HTTPS requests to Core_Backend target group based on path-based routing rules
5. THE Load_Balancer SHALL route WebSocket requests to Realtime_Backend target group based on path-based routing rules
6. WHEN an ECS_Task fails health check 2 consecutive times, THE Load_Balancer SHALL remove the task from target group within 10 seconds
7. THE Load_Balancer SHALL perform health checks every 15 seconds on a designated health endpoint
8. THE Load_Balancer SHALL support SSL/TLS termination with certificates from AWS Certificate Manager
9. THE Load_Balancer SHALL distribute traffic using round-robin algorithm when sticky sessions are not required

### Requirement 4: Real-time Caching and Pub/Sub Layer

**User Story:** As a backend developer, I want a high-performance Redis instance for pub/sub messaging and caching, so that real-time messages are delivered with low latency across multiple backend instances.

#### Acceptance Criteria

1. THE Infrastructure SHALL provision Amazon ElastiCache for Redis in Single-AZ configuration in Private_Subnet
2. THE Cache_Layer SHALL support Redis Pub/Sub commands for real-time messaging
3. THE Cache_Layer SHALL provide latency below 1ms for 99th percentile operations
4. THE Cache_Layer SHALL support at least 10,000 concurrent connections
5. THE Cache_Layer SHALL enable encryption in-transit for all Redis connections
6. THE Cache_Layer SHALL enable encryption at-rest for persisted data
7. THE Cache_Layer SHALL use cache.t3.medium or equivalent instance type for MVP workload

### Requirement 5: Primary Database for Persistent Storage

**User Story:** As a backend developer, I want a managed relational database with automatic backups, so that user data, messages, and workspace information are reliably stored.

#### Acceptance Criteria

1. THE Infrastructure SHALL provision Amazon RDS PostgreSQL in Single-AZ configuration in Private_Subnet
2. THE Primary_Database SHALL perform automated daily backups with 7 days retention period
3. THE Primary_Database SHALL enable point-in-time recovery for up to 7 days
4. THE Primary_Database SHALL support at least 1000 concurrent connections
5. THE Primary_Database SHALL enable encryption at-rest using AWS KMS
6. THE Primary_Database SHALL enable encryption in-transit for all database connections
7. THE Primary_Database SHALL use db.t3.medium or equivalent instance type for MVP workload

### Requirement 6: File and Media Storage

**User Story:** As a user, I want to upload and share files and images, so that collaboration includes media-rich content.

#### Acceptance Criteria

1. THE Infrastructure SHALL provision Amazon S3 bucket for file storage
2. THE File_Storage SHALL enable versioning for file history tracking
3. THE File_Storage SHALL support presigned URLs for secure direct upload from Frontend_App
4. THE File_Storage SHALL support presigned URLs for secure direct download from Frontend_App
5. WHEN a file is uploaded, THE File_Storage SHALL store it with server-side encryption (SSE-S3 or SSE-KMS)
6. THE File_Storage SHALL support Cross-Origin Resource Sharing (CORS) for browser uploads
7. THE File_Storage SHALL implement lifecycle policies to transition old files to S3 Glacier after 90 days
8. THE File_Storage SHALL enable bucket logging for audit purposes
9. THE File_Storage SHALL provide at least 99.99% availability for file operations
10. THE Frontend_App SHALL access files directly from S3 using presigned URLs without CDN

### Requirement 7: WebRTC Signaling Infrastructure

**User Story:** As a user, I want to establish video/audio calls through WebRTC, so that I can communicate in real-time with other workspace members.

#### Acceptance Criteria

1. THE Realtime_Backend SHALL handle WebRTC signaling messages (offer, answer, ICE candidates) through WebSocket_Connection
2. WHEN a WebRTC signaling message is received, THE Realtime_Backend SHALL deliver it to target client within 200ms
3. THE Load_Balancer SHALL route WebRTC signaling traffic through WebSocket connections to Realtime_Backend
4. THE ECS_Task running Realtime_Backend SHALL maintain WebSocket_Connection for duration of call session
5. WHEN WebSocket_Connection is lost during signaling, THE Realtime_Backend SHALL support automatic reconnection with session recovery

### Requirement 8: STUN/TURN Service for NAT Traversal

**User Story:** As a user behind a restrictive firewall or NAT, I want video/audio calls to work reliably, so that I can communicate even when direct peer-to-peer connection fails.

#### Acceptance Criteria

1. THE Infrastructure SHALL integrate with Twilio Network Traversal Service for STUN/TURN functionality
2. THE Realtime_Backend SHALL generate Twilio ICE server credentials using Twilio API
3. WHEN a WebRTC call is initiated, THE Realtime_Backend SHALL provide Twilio STUN/TURN server URLs to clients
4. THE Twilio_STUN_TURN SHALL respond to STUN binding requests within 50ms
5. THE Twilio_STUN_TURN SHALL relay media streams when peer-to-peer connection fails
6. THE Realtime_Backend SHALL use time-limited Twilio credentials with expiration time of 24 hours
7. THE Infrastructure SHALL store Twilio API credentials in AWS Secrets Manager

### Requirement 9: Real-time Messaging with Low Latency

**User Story:** As a user, I want to send and receive text messages instantly, so that conversations feel natural and responsive.

#### Acceptance Criteria

1. WHEN a user sends a text message, THE Realtime_Backend SHALL publish it to Cache_Layer Pub/Sub channel within 10ms
2. WHEN a message is published to Pub/Sub channel, THE Cache_Layer SHALL deliver it to all subscribed Realtime_Backend instances within 5ms
3. WHEN a Realtime_Backend receives a message from Pub/Sub, THE Realtime_Backend SHALL push it to connected clients via WebSocket_Connection within 10ms
4. THE Infrastructure SHALL ensure total Message_Latency from sender to receiver is below 100ms for 95% of messages
5. WHEN a message is received by Realtime_Backend, THE Realtime_Backend SHALL persist it to Primary_Database asynchronously
6. THE Realtime_Backend SHALL maintain WebSocket_Connection with heartbeat interval of 30 seconds
7. WHEN a WebSocket_Connection is interrupted, THE Frontend_App SHALL automatically reconnect within 5 seconds

### Requirement 10: Presence Status Management

**User Story:** As a user, I want to see who is online in my workspace, so that I know when colleagues are available for real-time collaboration.

#### Acceptance Criteria

1. WHEN a user connects via WebSocket_Connection, THE Realtime_Backend SHALL set user Presence_Status to online in Cache_Layer
2. WHEN a user disconnects, THE Realtime_Backend SHALL update user Presence_Status to offline in Cache_Layer within 5 seconds
3. THE Cache_Layer SHALL use Redis keys with TTL of 60 seconds for Presence_Status tracking
4. THE Realtime_Backend SHALL refresh Presence_Status TTL every 30 seconds for connected users
5. WHEN a user Presence_Status changes, THE Realtime_Backend SHALL broadcast the change to all users in same workspace within 2 seconds
6. THE Realtime_Backend SHALL support at least 10,000 concurrent active Presence_Status entries in Cache_Layer
7. WHEN Cache_Layer becomes unavailable, THE Realtime_Backend SHALL queue presence updates in memory and retry for up to 30 seconds

### Requirement 11: Multi-tenant Workspace Isolation

**User Story:** As a workspace administrator, I want my workspace data and communications to be isolated from other workspaces, so that privacy and security are maintained.

#### Acceptance Criteria

1. THE Core_Backend SHALL enforce Tenant isolation at application layer using workspace_id in all database queries
2. THE Primary_Database SHALL store Tenant identifier (workspace_id) in all relevant tables (users, messages, channels)
3. THE Cache_Layer SHALL use Tenant identifier as key prefix for all cached data
4. THE File_Storage SHALL use Tenant identifier as S3 key prefix for all uploaded files
5. WHEN a user requests data, THE Core_Backend SHALL filter results to only include data belonging to user's Tenant
6. THE Core_Backend SHALL reject requests that attempt to access data from different Tenant
7. THE Realtime_Backend SHALL validate Tenant membership before broadcasting messages to WebSocket_Connection
8. THE Infrastructure SHALL support at least 1000 concurrent Tenant instances

### Requirement 12: Authentication and Authorization

**User Story:** As a security engineer, I want secure authentication and authorization mechanisms, so that only authorized users can access workspace resources.

#### Acceptance Criteria

1. THE Core_Backend SHALL authenticate users using JWT tokens with expiration time of 1 hour
2. THE Core_Backend SHALL validate JWT signature using shared secret or public key
3. WHEN a JWT token expires, THE Frontend_App SHALL refresh the token using refresh token mechanism
4. THE Realtime_Backend SHALL authenticate WebSocket_Connection using JWT token passed during connection handshake
5. WHEN WebSocket authentication fails, THE Realtime_Backend SHALL close the connection within 1 second
6. THE Infrastructure SHALL use IAM_Role for service-to-service authentication between AWS resources
7. THE Container_Pod SHALL use IAM_Role to access File_Storage, Cache_Layer, and Primary_Database
8. THE IAM_Role SHALL follow principle of least privilege, granting only necessary permissions

### Requirement 13: Monitoring and Logging

**User Story:** As a DevOps engineer, I want comprehensive monitoring and logging, so that I can troubleshoot issues quickly and maintain system health.

#### Acceptance Criteria

1. THE Infrastructure SHALL enable Amazon CloudWatch logging for all ECS_Task instances
2. THE ECS_Task SHALL send application logs to CloudWatch Logs with structured JSON format
3. THE Infrastructure SHALL create CloudWatch metrics for CPU, memory, network usage for all ECS_Task instances
4. THE Infrastructure SHALL create CloudWatch metrics for Cache_Layer operations (hit rate, latency, connections)
5. THE Infrastructure SHALL create CloudWatch metrics for Primary_Database operations (connections, queries, storage)
6. THE Infrastructure SHALL create CloudWatch alarms for critical metrics (error rate > 1%, latency > 1s, CPU > 80%)
7. WHEN a CloudWatch alarm triggers, THE Infrastructure SHALL send notifications via Amazon SNS
8. THE Load_Balancer SHALL send access logs to S3 bucket for analysis
9. THE Infrastructure SHALL retain CloudWatch logs for at least 30 days

### Requirement 14: Disaster Recovery and Backup

**User Story:** As a system administrator, I want automated backups and disaster recovery capabilities, so that data can be recovered in case of catastrophic failures.

#### Acceptance Criteria

1. THE Primary_Database SHALL perform automated backups daily with retention period of 7 days
2. THE Primary_Database SHALL enable point-in-time recovery for any time within backup retention period
3. THE File_Storage SHALL enable S3 versioning to recover from accidental deletions
4. THE Infrastructure SHALL maintain Infrastructure-as-Code (Terraform or CloudFormation) for complete environment recreation
5. THE Infrastructure SHALL document Recovery Time Objective (RTO) of 4 hours and Recovery Point Objective (RPO) of 24 hours
6. WHEN a disaster recovery scenario is triggered, THE Infrastructure SHALL support restoration from backups within documented RTO

### Requirement 15: Auto-scaling and Performance

**User Story:** As a product owner, I want the system to automatically scale resources based on demand, so that users experience consistent performance during varying usage levels.

#### Acceptance Criteria

1. THE ECS_Service SHALL configure target tracking scaling policy for Realtime_Backend with target CPU utilization of 60%
2. THE ECS_Service SHALL configure target tracking scaling policy for Core_Backend with target CPU utilization of 70%
3. WHEN Realtime_Backend CPU exceeds target for 2 minutes, THE Auto_Scaling_Policy SHALL scale up tasks within 1 minute
4. WHEN Realtime_Backend CPU falls below 30% for 10 minutes, THE Auto_Scaling_Policy SHALL scale down tasks to minimum count
5. THE ECS_Service SHALL configure minimum task count of 2 for Realtime_Backend for availability
6. THE ECS_Service SHALL configure minimum task count of 2 for Core_Backend for availability
7. THE Infrastructure SHALL maintain average response time below 200ms for 95% of API requests under normal load

### Requirement 16: Security Hardening

**User Story:** As a security officer, I want the infrastructure to follow security best practices, so that the system is protected against common attack vectors.

#### Acceptance Criteria

1. THE Infrastructure SHALL enable AWS GuardDuty for threat detection across all accounts
2. THE Infrastructure SHALL enable AWS Config for compliance monitoring of resource configurations
3. THE Infrastructure SHALL enforce HTTPS/TLS for all external communications
4. THE Infrastructure SHALL disable public access to Primary_Database and Cache_Layer instances
5. THE Security_Group SHALL implement principle of least privilege, opening only necessary ports
6. THE Infrastructure SHALL enable VPC Flow Logs for network traffic analysis
7. THE Infrastructure SHALL use AWS Secrets Manager for storing secrets (database passwords, API keys, Twilio credentials)
8. THE ECS_Task SHALL retrieve secrets from Secrets Manager at runtime, never hardcoded in images
9. THE Infrastructure SHALL rotate database credentials automatically every 90 days

### Requirement 17: Cost Optimization

**User Story:** As a finance manager, I want the infrastructure to be cost-optimized, so that we can deliver the service within MVP budget constraints.

#### Acceptance Criteria

1. THE Infrastructure SHALL use AWS Fargate Spot capacity for non-critical ECS_Task instances to reduce compute costs
2. THE Infrastructure SHALL configure S3 Intelligent-Tiering for File_Storage to automatically move infrequently accessed files to lower-cost tiers
3. THE Infrastructure SHALL use appropriate RDS and ElastiCache instance types (t3.medium) for MVP workload
4. THE Infrastructure SHALL implement CloudWatch billing alarms to alert when monthly costs exceed budget by 10%
5. THE Infrastructure SHALL use AWS Cost Explorer to track spending by service and optimize resource allocation
6. THE Infrastructure SHALL implement tagging strategy for all resources to enable cost allocation reporting

### Requirement 18: CI/CD Integration

**User Story:** As a developer, I want seamless CI/CD integration with the AWS infrastructure, so that code changes can be deployed rapidly and safely.

#### Acceptance Criteria

1. THE Infrastructure SHALL support deployment pipeline using Git Flow branching strategy
2. THE Infrastructure SHALL integrate with CI/CD tool (GitHub Actions, GitLab CI, or AWS CodePipeline)
3. WHEN code is pushed to main branch, THE CI/CD pipeline SHALL build Docker images and push to Amazon ECR
4. WHEN Docker images are pushed to ECR, THE CI/CD pipeline SHALL trigger ECS service update with new task definition
5. THE ECS_Service SHALL perform rolling updates with zero downtime
6. THE ECS_Service SHALL validate task health before removing old tasks during rolling update
7. WHEN a deployment fails health checks, THE ECS_Service SHALL automatically rollback to previous task definition
8. THE Infrastructure SHALL maintain separate environments (development, staging, production) with isolated resources
9. THE CI/CD pipeline SHALL run automated tests before deploying to production environment
10. THE CI/CD pipeline SHALL require manual approval for production deployments

### Requirement 19: Operational Documentation and Infrastructure as Code

**User Story:** As a DevOps team member, I want complete infrastructure documentation and Infrastructure as Code, so that the environment is reproducible and maintainable.

#### Acceptance Criteria

1. THE Infrastructure SHALL be defined entirely in Infrastructure-as-Code using Terraform or AWS CloudFormation
2. THE Infrastructure code SHALL be version-controlled in Git repository
3. THE Infrastructure SHALL include architecture diagrams showing VPC layout, subnet topology, and data flow
4. THE Infrastructure SHALL include runbooks for common operational tasks (scaling, deployment, disaster recovery)
5. THE Infrastructure SHALL document all external dependencies (Twilio Network Traversal Service, third-party services)
6. THE Infrastructure SHALL document network ports, protocols, and security group rules in a centralized reference
7. THE Infrastructure SHALL document IAM roles and permissions for all services
8. THE Infrastructure SHALL maintain README with setup instructions and prerequisites
9. WHEN Infrastructure-as-Code is executed, THE Infrastructure SHALL provision a complete working environment
10. THE Infrastructure SHALL include cost estimation documentation based on expected MVP usage patterns
