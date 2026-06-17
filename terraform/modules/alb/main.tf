# ─────────────────────────────────────────────────────────────────────────────
# ALB Module
#
# Creates:
#   • aws_lb                  – internet-facing Application Load Balancer
#   • aws_lb_target_group     – fe-tg      (port 80,   HTTP, Nginx SPA)
#   • aws_lb_target_group     – core-tg    (port 3000, HTTP)
#   • aws_lb_target_group     – rt-tg      (port 4000, HTTP, sticky)
#   • aws_lb_listener         – HTTP listener (port 80) with path-based routing
#   • aws_lb_listener_rule    – priority 1: /api/* → core-tg
#   • aws_lb_listener_rule    – priority 2: /ws/*  → rt-tg
#   default action            : → fe-tg (all other paths)
#
# NOTE (demo mode):
#   ACM certificate and HTTPS (port 443) have been removed.
#   All traffic is served over plain HTTP on port 80 via the default ALB DNS name.
#   To re-enable HTTPS: restore the aws_acm_certificate resource and replace
#   the HTTP listener with an HTTPS listener (port 443).
#
# Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9
# ─────────────────────────────────────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Application Load Balancer
#
# Requirement 3.1: Single ALB in public subnets (internet-facing).
# Requirement 3.2: idle_timeout = 3600 s to keep WebSocket connections alive.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb" "this" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  ip_address_type    = "ipv4"
  subnets            = var.public_subnet_ids
  security_groups    = [var.alb_sg_id]

  # Keep WebSocket connections alive for up to 1 hour
  idle_timeout = 3600

  # Set to false for demo/dev; enable in production
  enable_deletion_protection = false

  access_logs {
    bucket  = var.alb_logs_bucket
    prefix  = "alb-logs"
    enabled = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# Target Group – Frontend (Nginx)
#
# Default route: all paths not matched by /api/* or /ws/* land here.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "frontend" {
  name                 = "${local.name_prefix}-fe-tg"
  protocol             = "HTTP"
  port                 = 80
  target_type          = "ip"
  vpc_id               = var.vpc_id
  deregistration_delay = 30

  health_check {
    enabled             = true
    path                = "/"
    protocol            = "HTTP"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
    matcher             = "200"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-fe-tg"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# Target Group – Core Backend
#
# Requirement 3.4: /api/* traffic forwards to this group.
# Requirement 3.6: unhealthy tasks removed after 2 consecutive failures.
# Requirement 3.7: health checks every 15 seconds.
# Requirement 3.9: round-robin load balancing (default; no stickiness).
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "core_backend" {
  name                 = "${local.name_prefix}-core-tg"
  protocol             = "HTTP"
  port                 = 3000
  target_type          = "ip"
  vpc_id               = var.vpc_id
  deregistration_delay = 30

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
    matcher             = "200"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-core-tg"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# Target Group – Realtime Backend
#
# Requirement 3.3: Sticky sessions (lb_cookie, 3600 s) keep WebSocket
#                  connections pinned to the same backend instance.
# Requirement 3.5: /ws/* traffic forwards to this group.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "realtime_backend" {
  name                 = "${local.name_prefix}-rt-tg"
  protocol             = "HTTP"
  port                 = 4000
  target_type          = "ip"
  vpc_id               = var.vpc_id
  deregistration_delay = 60

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
    matcher             = "200"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 3600
    enabled         = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rt-tg"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# HTTP Listener (port 80)
#
# Default action: forward to fe-tg (Nginx static SPA).
# Path-based rules below override this for API and WebSocket paths.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  # Default: serve the frontend for all non-API, non-WS paths
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-http-listener"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# Listener Rules
#
# Requirement 3.4: priority 1 – /api/* → core-tg
# Requirement 3.5: priority 2 – /ws/*  → rt-tg (sticky sessions)
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 1

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.core_backend.arn
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-api-rule"
  })
}

resource "aws_lb_listener_rule" "ws" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 2

  condition {
    path_pattern {
      values = ["/ws/*"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.realtime_backend.arn
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ws-rule"
  })
}
