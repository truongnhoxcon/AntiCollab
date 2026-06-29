# ─────────────────────────────────────────────────────────────────────────────
# CloudFront Distribution
#
# Provides HTTPS (TLS 1.2+) for the application WITHOUT requiring a custom
# domain. AWS issues a free certificate for *.cloudfront.net automatically.
#
# Architecture:
#   Browser (HTTPS/WSS)
#     → CloudFront  (TLS terminated, *.cloudfront.net cert)
#         → ALB HTTP:80 (internal, path-based routing already configured)
#             /api/*  → core-backend  ECS tasks
#             /ws/*   → realtime-backend ECS tasks  (WebSocket)
#             /*      → frontend Nginx container
#
# Why CloudFront instead of ACM on ALB:
#   ACM certificates on ALB require a Route 53 / DNS-validated custom domain.
#   CloudFront distributions get a *.cloudfront.net certificate for free with
#   no domain ownership verification needed — perfect for staging/demo.
#
# WebSocket support:
#   CloudFront supports WebSocket upgrades natively on HTTPS origins.
#   The /ws/* cache behavior disables caching and forwards all headers so the
#   Upgrade/Connection headers pass through to the ALB → realtime-backend.
# ─────────────────────────────────────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ─────────────────────────────────────────────────────────────────────────────
# Origin Request Policy – forward all headers needed by WebSocket & API
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_cloudfront_origin_request_policy" "alb_forward_all" {
  name    = "${local.name_prefix}-alb-forward-all"
  comment = "Forward all headers, cookies, and query strings to ALB origin"

  cookies_config {
    cookie_behavior = "all"
  }

  headers_config {
    header_behavior = "allViewer"
  }

  query_strings_config {
    query_string_behavior = "all"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Cache Policy – no caching for API and WebSocket paths
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_cloudfront_cache_policy" "no_cache" {
  name        = "${local.name_prefix}-no-cache"
  comment     = "No caching – used for /api/* and /ws/* dynamic paths"
  default_ttl = 0
  max_ttl     = 0
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = false
    enable_accept_encoding_gzip   = false
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# CloudFront Distribution
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name_prefix} – HTTPS via CloudFront (no custom domain)"
  default_root_object = ""
  price_class         = "PriceClass_100" # US, Canada, Europe only – cheapest tier

  # ── Origin: ALB ──────────────────────────────────────────────────────────
  origin {
    domain_name = var.alb_dns_name
    origin_id   = "alb-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only" # ALB listens on HTTP:80
      origin_ssl_protocols   = ["TLSv1.2"]

      # Keep WebSocket connections alive through CloudFront
      origin_keepalive_timeout = 60
      origin_read_timeout      = 60
    }
  }

  # ── Default cache behavior: frontend SPA (/*) ─────────────────────────────
  default_cache_behavior {
    target_origin_id       = "alb-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # Use managed CachingOptimized policy for static frontend assets
    cache_policy_id          = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized (AWS managed)
    origin_request_policy_id = aws_cloudfront_origin_request_policy.alb_forward_all.id
  }

  # ── /api/* cache behavior: REST API – no cache, all headers forwarded ─────
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "alb-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = false

    cache_policy_id          = aws_cloudfront_cache_policy.no_cache.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.alb_forward_all.id
  }

  # ── /ws/* cache behavior: WebSocket – no cache, all headers forwarded ─────
  # CloudFront passes Upgrade: websocket and Connection: Upgrade through
  # to the ALB when allViewer header policy is used.
  ordered_cache_behavior {
    path_pattern           = "/ws/*"
    target_origin_id       = "alb-origin"
    viewer_protocol_policy = "https-only" # wss:// only — no ws:// fallback
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = false

    cache_policy_id          = aws_cloudfront_cache_policy.no_cache.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.alb_forward_all.id
  }

  # ── Geo restriction: none ─────────────────────────────────────────────────
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # ── TLS: use CloudFront's default *.cloudfront.net certificate ────────────
  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  tags = {
    Name        = "${local.name_prefix}-cloudfront"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}
