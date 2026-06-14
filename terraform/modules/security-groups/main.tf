# ─────────────────────────────────────────────────────────────────────────────
# Security Groups Module
# Creates all security groups implementing the principle of least privilege.
# Each group opens only the ports strictly required by that component.
# Requirements: 2.8, 2.9, 2.10, 16.4, 16.5
# ─────────────────────────────────────────────────────────────────────────────

# ─── ALB Security Group ───────────────────────────────────────────────────────
# Requirement 2.8: Allows inbound HTTPS (443) and HTTP (80) from the internet.
# Outbound is scoped to the two backend security groups only.

resource "aws_security_group" "alb_sg" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Application Load Balancer: accepts HTTPS/HTTP from internet, forwards to backend services"
  vpc_id      = var.vpc_id

  # ── Inbound ──────────────────────────────────────────────────────────────

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from internet (redirect to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # ── Outbound ─────────────────────────────────────────────────────────────

  egress {
    description     = "Forward to Core Backend on port 3000"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.core_backend_sg.id]
  }

  egress {
    description     = "Forward to Realtime Backend on port 4000"
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.realtime_backend_sg.id]
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-alb-sg"
    Environment = var.environment
    Project     = var.project_name
  })
}

# ─── Core Backend Security Group ─────────────────────────────────────────────
# Requirement 2.9: Accepts inbound traffic only from the ALB security group.
# Outbound: RDS, Redis, and HTTPS (AWS APIs / Twilio via NAT Gateway).

resource "aws_security_group" "core_backend_sg" {
  name        = "${var.project_name}-${var.environment}-core-backend-sg"
  description = "Core Backend ECS tasks: inbound from ALB, outbound to RDS/Redis/internet"
  vpc_id      = var.vpc_id

  # ── Inbound ──────────────────────────────────────────────────────────────

  ingress {
    description     = "HTTP from ALB on port 3000"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  # ── Outbound ─────────────────────────────────────────────────────────────

  egress {
    description     = "PostgreSQL to RDS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.rds_sg.id]
  }

  egress {
    description     = "Redis to ElastiCache"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.redis_sg.id]
  }

  egress {
    description = "HTTPS to internet (AWS APIs and Twilio via NAT Gateway)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-core-backend-sg"
    Environment = var.environment
    Project     = var.project_name
  })
}

# ─── Realtime Backend Security Group ─────────────────────────────────────────
# Requirement 2.9: Accepts inbound traffic only from the ALB security group.
# Outbound: RDS, Redis, and HTTPS (Twilio WebRTC API / AWS APIs via NAT Gateway).

resource "aws_security_group" "realtime_backend_sg" {
  name        = "${var.project_name}-${var.environment}-realtime-backend-sg"
  description = "Realtime Backend ECS tasks: inbound from ALB, outbound to RDS/Redis/internet"
  vpc_id      = var.vpc_id

  # ── Inbound ──────────────────────────────────────────────────────────────

  ingress {
    description     = "WebSocket from ALB on port 4000"
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  # ── Outbound ─────────────────────────────────────────────────────────────

  egress {
    description     = "PostgreSQL to RDS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.rds_sg.id]
  }

  egress {
    description     = "Redis to ElastiCache"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.redis_sg.id]
  }

  egress {
    description = "HTTPS to internet (Twilio API and AWS APIs via NAT Gateway)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-realtime-backend-sg"
    Environment = var.environment
    Project     = var.project_name
  })
}

# ─── RDS Security Group ───────────────────────────────────────────────────────
# Requirements 2.10, 16.4, 16.5: Accepts PostgreSQL connections only from the
# two ECS backend security groups. No outbound rules — the database never
# initiates outbound connections.

resource "aws_security_group" "rds_sg" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "RDS PostgreSQL: inbound from backend ECS tasks only, no outbound"
  vpc_id      = var.vpc_id

  # ── Inbound ──────────────────────────────────────────────────────────────

  ingress {
    description     = "PostgreSQL from Core Backend"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.core_backend_sg.id]
  }

  ingress {
    description     = "PostgreSQL from Realtime Backend"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.realtime_backend_sg.id]
  }

  # No egress blocks — database does not initiate outbound connections.
  # Note: AWS adds a default allow-all egress rule when no egress block is
  # specified. To explicitly remove it use the aws_security_group_rule resource
  # with revoke_rules_on_delete, or manage egress rules separately if stricter
  # lockdown is required in a future task.

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-rds-sg"
    Environment = var.environment
    Project     = var.project_name
  })
}

# ─── Redis Security Group ─────────────────────────────────────────────────────
# Requirements 2.10, 16.4, 16.5: Accepts Redis connections only from the two
# ECS backend security groups. No outbound rules — the cache never initiates
# outbound connections.

resource "aws_security_group" "redis_sg" {
  name        = "${var.project_name}-${var.environment}-redis-sg"
  description = "ElastiCache Redis: inbound from backend ECS tasks only, no outbound"
  vpc_id      = var.vpc_id

  # ── Inbound ──────────────────────────────────────────────────────────────

  ingress {
    description     = "Redis from Core Backend"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.core_backend_sg.id]
  }

  ingress {
    description     = "Redis from Realtime Backend"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.realtime_backend_sg.id]
  }

  # No egress blocks — cache does not initiate outbound connections.

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-redis-sg"
    Environment = var.environment
    Project     = var.project_name
  })
}
