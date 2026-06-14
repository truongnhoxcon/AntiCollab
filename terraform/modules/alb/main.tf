# ─────────────────────────────────────────────────────────────────────────────
# ALB Module
#
# Creates:
#   • aws_lb                       – internet-facing Application Load Balancer
#   • aws_lb_target_group          – core-backend-tg  (port 3000, HTTP)
#   • aws_lb_target_group          – realtime-backend-tg (port 4000, HTTP, sticky)
#   • aws_acm_certificate          – ACM certificate (DNS validation)
#   • aws_lb_listener              – HTTPS listener (port 443, TLS 1.3)
#   • aws_lb_listener              – HTTP listener  (port 80, redirect → HTTPS)
#   • aws_lb_listener_rule         – priority 1: /api/*  → core-backend-tg
#   • aws_lb_listener_rule         – priority 2: /ws/*   → realtime-backend-tg
#
# Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 16.3
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
# ACM Certificate
#
# Requirement 3.8: SSL/TLS termination via ACM.
# We create the certificate resource with DNS validation so the module works
# even when no certificate pre-exists.  A lifecycle create_before_destroy
# ensures zero-downtime rotations.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_acm_certificate" "alb" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-acm-cert"
  })
}

# Local: single reference to the certificate ARN used by the HTTPS listener.
locals {
  certificate_arn = aws_acm_certificate.alb.arn
}

# ─────────────────────────────────────────────────────────────────────────────
# Application Load Balancer
#
# Requirement 3.1: Single ALB in public subnets (internet-facing).
# Requirement 3.2: idle_timeout = 3600 seconds to keep WebSocket connections
#                  alive without mid-stream disconnects.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb" "this" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  ip_address_type    = "ipv4"
  subnets            = var.public_subnet_ids
  security_groups    = [var.alb_sg_id]

  # WebSocket support: keep connections open for up to 1 hour
  idle_timeout = 3600

  # Protect against accidental deletion in production
  enable_deletion_protection = true

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
# Target Group – Core Backend
#
# Requirement 3.4: /api/* traffic forwards to this group.
# Requirement 3.6: unhealthy tasks removed after 2 consecutive failures.
# Requirement 3.7: health checks every 15 seconds.
# Requirement 3.9: round-robin load balancing (default ALB behavior, no stickiness).
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "core_backend" {
  name                 = "${local.name_prefix}-core-backend-tg"
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
    Name = "${local.name_prefix}-core-backend-tg"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# Target Group – Realtime Backend
#
# Requirement 3.3: Sticky sessions (lb_cookie, 3600 s) keep WebSocket
#                  connections pinned to the same backend instance.
# Requirement 3.5: /ws/* traffic forwards to this group.
# Requirement 3.6 & 3.7: same health-check thresholds / interval as above.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "realtime_backend" {
  name                 = "${local.name_prefix}-realtime-backend-tg"
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
    Name = "${local.name_prefix}-realtime-backend-tg"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# HTTPS Listener (port 443)
#
# Requirement 3.8:  SSL/TLS termination at the ALB using ACM certificate.
# Requirement 16.3: Enforce TLS 1.3 via ELBSecurityPolicy-TLS13-1-2-2021-06.
# Default action returns 404 for paths not matched by any listener rule.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = local.certificate_arn

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-https-listener"
  })

  depends_on = [aws_acm_certificate.alb]
}

# ─────────────────────────────────────────────────────────────────────────────
# HTTP Listener (port 80)
#
# Requirement 16.3: Redirect all plain-HTTP traffic to HTTPS (301 Permanent).
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-http-listener"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# Listener Rules
#
# Requirement 3.4: priority 1 – /api/* → core-backend-tg
# Requirement 3.5: priority 2 – /ws/*  → realtime-backend-tg
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
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
  listener_arn = aws_lb_listener.https.arn
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
