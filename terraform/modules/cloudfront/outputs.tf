output "cloudfront_domain" {
  description = "CloudFront distribution domain name (e.g. d1234abcd.cloudfront.net). Use this as the app URL."
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_https_url" {
  description = "Full HTTPS URL of the CloudFront distribution."
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID. Needed for cache invalidation in CI/CD."
  value       = aws_cloudfront_distribution.main.id
}
