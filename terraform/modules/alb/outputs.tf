# ─────────────────────────────────────────────────────────────────────────────
# ALB Module Outputs
# ─────────────────────────────────────────────────────────────────────────────

output "alb_arn" {
  description = "ARN of the Application Load Balancer."
  value       = aws_lb.this.arn
}

output "alb_dns_name" {
  description = "Plain HTTP URL of the Application Load Balancer (demo mode, no custom domain required)."
  value       = "http://${aws_lb.this.dns_name}"
}

output "alb_raw_dns" {
  description = "Raw DNS name of the ALB (without protocol prefix)."
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "Canonical hosted zone ID of the ALB (required for Route 53 alias records)."
  value       = aws_lb.this.zone_id
}

output "frontend_tg_arn" {
  description = "ARN of the frontend target group (port 80, Nginx SPA)."
  value       = aws_lb_target_group.frontend.arn
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
  description = "Placeholder: HTTPS listener removed in demo mode. Returns HTTP listener ARN instead."
  value       = aws_lb_listener.http.arn
}

output "http_listener_arn" {
  description = "ARN of the HTTP (port 80) listener."
  value       = aws_lb_listener.http.arn
}
