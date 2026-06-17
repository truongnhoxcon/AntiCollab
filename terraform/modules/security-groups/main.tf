# ─────────────────────────────────────────────────────────────────────────────
# Security Groups Module
#
# Pattern: "Empty shell + separate rules"
#
# All aws_security_group resources are declared WITHOUT any inline ingress or
# egress blocks. Rules are attached afterwards using aws_security_group_rule
# resources. This fully eliminates the Terraform cycle error that occurs when
# security groups reference each other's IDs inside inline rule blocks.
#
# Terraform can now build a clean dependency graph:
#   Phase 1 – create all 6 empty security groups (no cross-references)
#   Phase 2 – attach rules (each rule references already-known SG IDs)
#
# Requirements: 2.8, 2.9, 2.10, 16.4, 16.5
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 — Empty Security Group shells
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_security_group" "alb_sg" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "ALB: accepts HTTP 80 from internet, all egress allowed"
  vpc_id      = var.vpc_id

  # No inline ingress/egress — rules defined below via aws_security_group_rule

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-alb-sg"
    Environment = var.environment
    Project     = var.project_name
  })
}

resource "aws_security_group" "frontend_sg" {
  name        = "${var.project_name}-${var.environment}-frontend-sg"
  description = "Frontend ECS (Nginx): inbound port 80 from ALB only, all egress allowed"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-frontend-sg"
    Environment = var.environment
    Project     = var.project_name
  })
}

resource "aws_security_group" "core_backend_sg" {
  name        = "${var.project_name}-${var.environment}-core-backend-sg"
  description = "Core Backend ECS: inbound port 3000 from ALB only, all egress allowed"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-core-backend-sg"
    Environment = var.environment
    Project     = var.project_name
  })
}

resource "aws_security_group" "realtime_backend_sg" {
  name        = "${var.project_name}-${var.environment}-realtime-backend-sg"
  description = "Realtime Backend ECS: inbound port 4000 from ALB only, all egress allowed"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-realtime-backend-sg"
    Environment = var.environment
    Project     = var.project_name
  })
}

resource "aws_security_group" "rds_sg" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "RDS PostgreSQL: inbound port 5432 from backend ECS tasks only, no egress"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-rds-sg"
    Environment = var.environment
    Project     = var.project_name
  })
}

resource "aws_security_group" "redis_sg" {
  name        = "${var.project_name}-${var.environment}-redis-sg"
  description = "ElastiCache Redis: inbound port 6379 from backend ECS tasks only, no egress"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-redis-sg"
    Environment = var.environment
    Project     = var.project_name
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — ALB Security Group Rules
#
# Requirement 2.8: Inbound HTTP (80) from internet.
# Egress: open all — ALB must reach any target group (frontend/core/realtime).
# Using a single wide egress rule removes all cross-references from this SG.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_security_group_rule" "alb_ingress_http" {
  security_group_id = aws_security_group.alb_sg.id
  type              = "ingress"
  description       = "HTTP from internet"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "alb_egress_all" {
  security_group_id = aws_security_group.alb_sg.id
  type              = "egress"
  description       = "Allow all outbound (ALB forwards to target groups)"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — Frontend Security Group Rules
#
# Inbound: port 80 from ALB only (strict).
# Egress: open all — allows health-check responses and future outbound needs.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_security_group_rule" "frontend_ingress_http" {
  security_group_id        = aws_security_group.frontend_sg.id
  type                     = "ingress"
  description              = "HTTP from ALB on port 80"
  from_port                = 80
  to_port                  = 80
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb_sg.id
}

resource "aws_security_group_rule" "frontend_egress_all" {
  security_group_id = aws_security_group.frontend_sg.id
  type              = "egress"
  description       = "Allow all outbound"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — Core Backend Security Group Rules
#
# Inbound: port 3000 from ALB only (strict).
# Egress: open all — reaches RDS (5432), Redis (6379), AWS APIs (443) via NAT.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_security_group_rule" "core_backend_ingress_api" {
  security_group_id        = aws_security_group.core_backend_sg.id
  type                     = "ingress"
  description              = "REST API from ALB on port 3000"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb_sg.id
}

resource "aws_security_group_rule" "core_backend_egress_all" {
  security_group_id = aws_security_group.core_backend_sg.id
  type              = "egress"
  description       = "Allow all outbound (RDS, Redis, AWS APIs via NAT)"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — Realtime Backend Security Group Rules
#
# Inbound: port 4000 from ALB only (strict).
# Egress: open all — reaches RDS (5432), Redis (6379), Twilio API (443) via NAT.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_security_group_rule" "realtime_backend_ingress_ws" {
  security_group_id        = aws_security_group.realtime_backend_sg.id
  type                     = "ingress"
  description              = "WebSocket from ALB on port 4000"
  from_port                = 4000
  to_port                  = 4000
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb_sg.id
}

resource "aws_security_group_rule" "realtime_backend_egress_all" {
  security_group_id = aws_security_group.realtime_backend_sg.id
  type              = "egress"
  description       = "Allow all outbound (RDS, Redis, Twilio API via NAT)"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — RDS Security Group Rules
#
# Requirements 2.10, 16.4, 16.5: PostgreSQL (5432) from backend ECS tasks only.
# No egress — RDS never initiates outbound connections.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_security_group_rule" "rds_ingress_from_core_backend" {
  security_group_id        = aws_security_group.rds_sg.id
  type                     = "ingress"
  description              = "PostgreSQL from Core Backend"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.core_backend_sg.id
}

resource "aws_security_group_rule" "rds_ingress_from_realtime_backend" {
  security_group_id        = aws_security_group.rds_sg.id
  type                     = "ingress"
  description              = "PostgreSQL from Realtime Backend"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.realtime_backend_sg.id
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — Redis Security Group Rules
#
# Requirements 2.10, 16.4, 16.5: Redis (6379) from backend ECS tasks only.
# No egress — ElastiCache never initiates outbound connections.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_security_group_rule" "redis_ingress_from_core_backend" {
  security_group_id        = aws_security_group.redis_sg.id
  type                     = "ingress"
  description              = "Redis from Core Backend"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.core_backend_sg.id
}

resource "aws_security_group_rule" "redis_ingress_from_realtime_backend" {
  security_group_id        = aws_security_group.redis_sg.id
  type                     = "ingress"
  description              = "Redis from Realtime Backend"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.realtime_backend_sg.id
}
