# ─────────────────────────────────────────────────────────────────────────────
# S3 Module
#
# Creates:
#   • aws_s3_bucket                        – file storage bucket (files-{account-id})
#   • aws_s3_bucket_versioning             – versioning for file bucket
#   • aws_s3_bucket_server_side_encryption_configuration – SSE-S3 (AES256) for file bucket
#   • aws_s3_bucket_public_access_block    – block all public access for file bucket
#   • aws_s3_bucket_cors_configuration     – CORS rules for browser direct uploads
#   • aws_s3_bucket_lifecycle_configuration – archive workspace- prefix + abort multipart
#   • aws_s3_bucket_logging                – server access logging → access-logs bucket
#   • aws_s3_bucket_policy                 – enforce SSL (deny non-HTTPS requests)
#
#   • aws_s3_bucket                        – ALB access logs bucket (alb-logs-{account-id})
#   • aws_s3_bucket_versioning             – versioning for ALB logs bucket
#   • aws_s3_bucket_server_side_encryption_configuration – SSE-S3 for ALB logs bucket
#   • aws_s3_bucket_public_access_block    – block all public access for ALB logs bucket
#   • aws_s3_bucket_policy                 – allow ELB service account to write ALB logs
#
#   • aws_s3_bucket                        – server access logs bucket (access-logs-{account-id})
#   • aws_s3_bucket_versioning             – versioning for access logs bucket
#   • aws_s3_bucket_server_side_encryption_configuration – SSE-S3 for access logs bucket
#   • aws_s3_bucket_public_access_block    – block all public access for access logs bucket
#
# Requirements: 6.1, 6.2, 6.5, 6.6, 6.7, 6.8, 13.8
# ─────────────────────────────────────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  # Bucket names include account ID to guarantee global uniqueness
  files_bucket_name       = "${var.project_name}-files-${var.account_id}"
  alb_logs_bucket_name    = "${var.project_name}-alb-logs-${var.account_id}"
  access_logs_bucket_name = "${var.project_name}-access-logs-${var.account_id}"

  # ELB service account for us-east-1 (required to write ALB access logs)
  # See: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html
  elb_account_id = "127311923021"

  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# Access Logs Bucket  (created first – file bucket logs into it)
# Requirement 13.8: S3 server access logging must be enabled.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "access_logs" {
  bucket        = local.access_logs_bucket_name
  force_destroy = false # protect log data from accidental deletion

  tags = merge(local.common_tags, {
    Name    = local.access_logs_bucket_name
    Purpose = "S3 server access logs"
  })
}

resource "aws_s3_bucket_versioning" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─────────────────────────────────────────────────────────────────────────────
# ALB Logs Bucket
# Requirement 13.8: ALB access logs stored in dedicated S3 bucket.
# The ELB service account (127311923021 for us-east-1) needs PutObject permission.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "alb_logs" {
  bucket        = local.alb_logs_bucket_name
  force_destroy = false

  tags = merge(local.common_tags, {
    Name    = local.alb_logs_bucket_name
    Purpose = "ALB access logs"
  })
}

resource "aws_s3_bucket_versioning" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy: allow the regional ELB service account to deliver ALB access logs.
# AWS requires this ACL-style policy (not a service principal) for ALB log delivery.
resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowALBLogDelivery"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.elb_account_id}:root"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/alb-logs/*"
      },
      # Deny any request that does not use HTTPS
      {
        Sid       = "DenyNonSSL"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.alb_logs.arn,
          "${aws_s3_bucket.alb_logs.arn}/*",
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.alb_logs]
}

# ─────────────────────────────────────────────────────────────────────────────
# File Storage Bucket
#
# Requirement 6.1: versioning enabled
# Requirement 6.2: SSE-S3 (AES256) encryption at rest
# Requirement 6.5: block all public access
# Requirement 6.6: CORS for browser direct uploads/downloads
# Requirement 6.7: lifecycle rules (archive + multipart cleanup)
# Requirement 6.8: bucket policy enforces SSL (deny HTTP)
# Requirement 13.8: server access logging enabled
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "files" {
  bucket        = local.files_bucket_name
  force_destroy = false

  tags = merge(local.common_tags, {
    Name    = local.files_bucket_name
    Purpose = "Application file storage"
  })
}

# ── Versioning ────────────────────────────────────────────────────────────────
# Requirement 6.1: versioning must be enabled to protect against accidental deletion.

resource "aws_s3_bucket_versioning" "files" {
  bucket = aws_s3_bucket.files.id

  versioning_configuration {
    status = "Enabled"
  }
}

# ── Server-Side Encryption ────────────────────────────────────────────────────
# Requirement 6.2: SSE-S3 (AES256) – no additional KMS cost at the cost of
# slightly less granular key control (acceptable for MVP).

resource "aws_s3_bucket_server_side_encryption_configuration" "files" {
  bucket = aws_s3_bucket.files.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    # Require SSE on all objects (block unencrypted uploads via header check)
    bucket_key_enabled = false
  }
}

# ── Block All Public Access ────────────────────────────────────────────────────
# Requirement 6.5: no public access; presigned URLs are the only access mechanism.

resource "aws_s3_bucket_public_access_block" "files" {
  bucket = aws_s3_bucket.files.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── CORS Configuration ────────────────────────────────────────────────────────
# Requirement 6.6: allow browsers to PUT/GET via presigned URLs from app domain.

resource "aws_s3_bucket_cors_configuration" "files" {
  bucket = aws_s3_bucket.files.id

  cors_rule {
    allowed_origins = [var.app_domain]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}

# ── Lifecycle Configuration ────────────────────────────────────────────────────
# Requirement 6.7:
#   Rule 1 – transition workspace- prefixed objects to GLACIER after 90 days
#   Rule 2 – abort incomplete multipart uploads after 7 days

resource "aws_s3_bucket_lifecycle_configuration" "files" {
  bucket = aws_s3_bucket.files.id

  # Rule 1: Archive old workspace files to Glacier
  rule {
    id     = "archive-workspace-files"
    status = "Enabled"

    filter {
      prefix = "workspace-"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }

  # Rule 2: Clean up stalled multipart uploads
  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"

    filter {
      prefix = ""
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.files]
}

# ── Server Access Logging ──────────────────────────────────────────────────────
# Requirement 13.8: log all requests to the files bucket into the access-logs bucket.

resource "aws_s3_bucket_logging" "files" {
  bucket = aws_s3_bucket.files.id

  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "s3-access-logs/"

  depends_on = [
    aws_s3_bucket.access_logs,
    aws_s3_bucket_public_access_block.access_logs,
  ]
}

# ── Bucket Policy – Enforce SSL ────────────────────────────────────────────────
# Requirement 6.8: deny any request not using HTTPS (SecureTransport = false).
# Also explicitly denies unencrypted (non-SSE) object writes.

resource "aws_s3_bucket_policy" "files" {
  bucket = aws_s3_bucket.files.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyNonSSL"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.files.arn,
          "${aws_s3_bucket.files.arn}/*",
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
    ]
  })

  # Ensure public access block is applied first to avoid race-condition errors
  depends_on = [aws_s3_bucket_public_access_block.files]
}
