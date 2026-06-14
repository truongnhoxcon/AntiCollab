# ─────────────────────────────────────────────────────────────────────────────
# ElastiCache Redis Module
#
# Creates:
#   • aws_elasticache_subnet_group      – places the cluster in private subnets
#   • data aws_secretsmanager_secret_version – reads Redis auth token at plan time
#   • aws_elasticache_replication_group – Redis 7.2, Single-AZ, cache.t3.medium
#
# Requirements: 4.1, 4.2, 4.5, 4.6, 4.7
# ─────────────────────────────────────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# Secrets Manager – retrieve Redis auth token
# Requirement 4.7: auth token must never be hardcoded in IaC; read from
# Secrets Manager at plan/apply time.
# ─────────────────────────────────────────────────────────────────────────────

data "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id = var.redis_auth_secret_arn
}

locals {
  # The secret is stored as JSON: {"token":"..."}
  redis_auth_token = jsondecode(data.aws_secretsmanager_secret_version.redis_auth.secret_string)["token"]
}

# ─────────────────────────────────────────────────────────────────────────────
# ElastiCache Subnet Group
# Requirement 4.1: Redis cluster must reside in private subnets inside the VPC.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "main" {
  name        = "${local.name_prefix}-redis-subnet-group"
  description = "Private subnet group for ${local.name_prefix} ElastiCache Redis cluster"
  subnet_ids  = var.private_subnet_ids

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-subnet-group"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# ElastiCache Replication Group (Redis 7.2, Single-AZ)
#
# Requirement 4.1: cluster placed in private subnets via subnet_group_name
# Requirement 4.2: cache.t3.medium instance type for MVP workload
# Requirement 4.5: encryption at-rest (at_rest_encryption_enabled = true)
# Requirement 4.6: encryption in-transit (transit_encryption_enabled = true)
# Requirement 4.7: auth_token read from Secrets Manager (not hardcoded)
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_elasticache_replication_group" "main" {
  # ── Identity ──────────────────────────────────────────────────────────────

  # Replication group ID must be 40 characters or less
  replication_group_id = "${local.name_prefix}-redis"
  description          = "Redis 7.2 Single-AZ cluster for ${local.name_prefix} real-time collaboration"

  # ── Engine ────────────────────────────────────────────────────────────────

  engine         = "redis"
  engine_version = "7.2" # Latest stable 7.x (Requirement 4.2)
  node_type      = "cache.t3.medium" # Requirement 4.2

  # ── Cluster topology – Single-AZ, no replicas ─────────────────────────────

  num_cache_clusters         = 1     # Single primary, no read replicas
  automatic_failover_enabled = false # Requires num_cache_clusters > 1
  multi_az_enabled           = false # Single-AZ for MVP cost optimisation

  # ── Security ──────────────────────────────────────────────────────────────

  transit_encryption_enabled  = true                    # Requirement 4.6: TLS in-transit
  at_rest_encryption_enabled  = true                    # Requirement 4.5: encryption at-rest
  auth_token                  = local.redis_auth_token  # Requirement 4.7: token from Secrets Manager

  # ── Networking ────────────────────────────────────────────────────────────

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [var.redis_sg_id] # Requirement 4.1: restricted by security group

  # ── Backup and Maintenance ────────────────────────────────────────────────

  snapshot_retention_limit = 1                       # Keep daily snapshots for 1 day
  snapshot_window          = "03:00-04:00"           # Daily backup window (UTC)
  maintenance_window       = "sun:04:00-sun:05:00"   # Weekly maintenance window (UTC)

  # ── Upgrade ───────────────────────────────────────────────────────────────

  auto_minor_version_upgrade = true

  # ── Notifications ─────────────────────────────────────────────────────────

  # Use null when sns_topic_arn is not provided to avoid passing an empty string
  notification_topic_arn = var.sns_topic_arn != "" ? var.sns_topic_arn : null

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis"
  })

  depends_on = [
    aws_elasticache_subnet_group.main,
  ]
}
