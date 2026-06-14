# ─────────────────────────────────────────────────────────────────────────────
# ALB Module Outputs
# ─────────────────────────────────────────────────────────────────────────────

output "alb_arn" {
  description = "ARN of the Application Load Balancer."
  value       = aws_lb.this.arn
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer (use for Route 53 alias records)."
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "Canonical hosted zone ID of the ALB (required for Route 53 alias records)."
  value       = aws_lb.this.zone_id
}

output "core_backend_tg_arn" {
  description = "ARN of the core-backend target group (port 3000)."
  value       = aws_lb_target_group.core_backend.arn
}

output "realtime_backend_tg_arn" {
  description = "ARN of the realtime-backend target group (port 4000, sticky sessions)."
  value       = aws_lb_target_group.realtime_backend.arn
}

output "https_listener_arn" {
  description = "ARN of the HTTPS (port 443) listener."
  value       = aws_lb_listener.https.arn
}

output "http_listener_arn" {
  description = "ARN of the HTTP (port 80) listener (redirects to HTTPS)."
  value       = aws_lb_listener.http.arn
}

output "acm_certificate_arn" {
  description = "ARN of the ACM certificate used for TLS termination on the ALB."
  value       = aws_acm_certificate.alb.arn
}
