# ─────────────────────────────────────────────────────────────────────────────
# S3 Module – Outputs
# ─────────────────────────────────────────────────────────────────────────────

# ── File Storage Bucket ───────────────────────────────────────────────────────

output "files_bucket_id" {
  description = "Name (ID) of the file storage S3 bucket."
  value       = aws_s3_bucket.files.id
}

output "files_bucket_arn" {
  description = "ARN of the file storage S3 bucket. Used by IAM module to scope ECS task role permissions."
  value       = aws_s3_bucket.files.arn
}

# ── ALB Logs Bucket ───────────────────────────────────────────────────────────

output "alb_logs_bucket_id" {
  description = "Name (ID) of the ALB access logs S3 bucket. Pass to the ALB module as the access log destination."
  value       = aws_s3_bucket.alb_logs.id
}

output "alb_logs_bucket_arn" {
  description = "ARN of the ALB access logs S3 bucket."
  value       = aws_s3_bucket.alb_logs.arn
}

# ── Access Logs Bucket ────────────────────────────────────────────────────────

output "access_logs_bucket_id" {
  description = "Name (ID) of the S3 server access logs bucket."
  value       = aws_s3_bucket.access_logs.id
}

output "access_logs_bucket_arn" {
  description = "ARN of the S3 server access logs bucket."
  value       = aws_s3_bucket.access_logs.arn
}
