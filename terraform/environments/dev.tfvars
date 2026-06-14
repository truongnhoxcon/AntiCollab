# ─────────────────────────────────────────────────────────────────────────────
# Development environment variable overrides
# ─────────────────────────────────────────────────────────────────────────────

aws_region   = "us-east-1"
environment  = "dev"
project_name = "realtime-collab"

# Set your actual AWS account ID before running terraform apply
account_id = "123456789012"

# Networking – dev uses 10.1.0.0/16
vpc_cidr = "10.1.0.0/16"

# Application images – updated by CI/CD pipeline on each deploy; set placeholder for first apply
core_backend_image     = ""
realtime_backend_image = ""

# DNS – use your actual domain
domain_name = "dev.yourdomain.com"

# Alerting
alert_email = "devops@yourdomain.com"
