# ─────────────────────────────────────────────────────────────────────────────
# RDS Module
#
# Creates:
#   • aws_db_subnet_group        – places the instance in private subnets
#   • aws_db_parameter_group     – enforces SSL connections (ssl=on)
#   • data aws_secretsmanager_secret_version – reads master password at plan time
#   • aws_iam_role (+ policy)    – Enhanced Monitoring role for RDS
#   • aws_db_instance            – PostgreSQL 15, Single-AZ, db.t3.medium
#
# Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1, 14.2
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
# Secrets Manager – retrieve master password
# Requirement 16.7, 16.8: secrets must never be hardcoded in IaC.
# ─────────────────────────────────────────────────────────────────────────────

data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = var.db_password_secret_arn
}

locals {
  # The secret is stored as JSON: {"username":"postgres","password":"..."}
  db_credentials = jsondecode(data.aws_secretsmanager_secret_version.db_password.secret_string)
}

# ─────────────────────────────────────────────────────────────────────────────
# DB Subnet Group
# Requirement 5.1: instance must reside in Private_Subnet inside the VPC.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-db-subnet-group"
  description = "Private subnet group for ${local.name_prefix} RDS PostgreSQL instance"
  subnet_ids  = var.private_subnet_ids

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# DB Parameter Group – enforce SSL
# Requirement 5.6: encryption in-transit for all database connections.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_db_parameter_group" "main" {
  name        = "${local.name_prefix}-pg15-ssl"
  family      = "postgres15"
  description = "PostgreSQL 15 parameter group for ${local.name_prefix}: enforces SSL"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "immediate"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-pg15-ssl"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# IAM Role for RDS Enhanced Monitoring
# Requirement 5.7 / design: monitoring_interval = 60 requires an IAM role with
# AmazonRDSEnhancedMonitoringRole and trust to monitoring.rds.amazonaws.com.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_iam_role" "rds_enhanced_monitoring" {
  name        = "${local.name_prefix}-rds-enhanced-monitoring-role"
  description = "Allows RDS to publish Enhanced Monitoring metrics to CloudWatch"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-enhanced-monitoring-role"
  })
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ─────────────────────────────────────────────────────────────────────────────
# RDS PostgreSQL Instance
#
# Requirement 5.1:  Single-AZ in Private_Subnet
# Requirement 5.2:  Automated daily backups, 7-day retention
# Requirement 5.3:  Point-in-time recovery (enabled by backup_retention_period > 0)
# Requirement 5.4:  Supports ≥1000 connections (controlled at app/parameter level)
# Requirement 5.5:  Encryption at-rest (storage_encrypted = true)
# Requirement 5.6:  Encryption in-transit (parameter group ssl=on + skip_final_snapshot=false)
# Requirement 5.7:  db.t3.medium for MVP workload
# Requirement 14.1: Automated daily backups with 7-day retention
# Requirement 14.2: Point-in-time recovery within backup retention window
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_db_instance" "main" {
  # ── Identity ──────────────────────────────────────────────────────────────

  identifier = "${local.name_prefix}-db"

  # ── Engine ────────────────────────────────────────────────────────────────

  engine         = "postgres"
  engine_version = "15"
  instance_class = "db.t3.medium"

  # ── Storage ───────────────────────────────────────────────────────────────

  allocated_storage     = 100
  max_allocated_storage = 500 # autoscaling cap
  storage_type          = "gp3"
  storage_encrypted     = true # Requirement 5.5

  # ── Database ──────────────────────────────────────────────────────────────

  db_name  = "realtime_collab"
  username = "postgres"
  password = local.db_credentials["password"] # pulled from Secrets Manager

  # ── Parameter group (enforces SSL) ────────────────────────────────────────

  parameter_group_name = aws_db_parameter_group.main.name

  # ── Networking ────────────────────────────────────────────────────────────

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.rds_sg_id]

  # No public access – instance lives in a private subnet (Requirement 16.4)
  publicly_accessible = false

  # ── High Availability ─────────────────────────────────────────────────────

  # Single-AZ for MVP cost optimisation (design decision)
  multi_az = false

  # ── Backup and Recovery ───────────────────────────────────────────────────

  backup_retention_period = 7         # Requirements 5.2, 5.3, 14.1, 14.2
  backup_window           = "03:00-04:00"
  maintenance_window      = "Sun:04:00-Sun:05:00"

  # Keep a final snapshot when the instance is destroyed
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name_prefix}-db-final-snapshot"
  copy_tags_to_snapshot     = true

  # ── Deletion Protection ───────────────────────────────────────────────────

  deletion_protection = true

  # ── Monitoring ────────────────────────────────────────────────────────────

  # Enhanced Monitoring at 60-second granularity
  monitoring_interval             = 60
  monitoring_role_arn             = aws_iam_role.rds_enhanced_monitoring.arn

  # Performance Insights (7-day free retention)
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  # CloudWatch Logs exports
  enabled_cloudwatch_logs_exports = ["postgresql"]

  # ── Auto Minor Version Upgrade ────────────────────────────────────────────

  auto_minor_version_upgrade = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db"
  })

  depends_on = [
    aws_db_subnet_group.main,
    aws_db_parameter_group.main,
    aws_iam_role_policy_attachment.rds_enhanced_monitoring,
  ]
}
