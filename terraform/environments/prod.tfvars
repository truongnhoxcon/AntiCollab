# ─────────────────────────────────────────────────────────────────────────────
# Production environment variable overrides
# ─────────────────────────────────────────────────────────────────────────────

aws_region   = "us-east-1"
environment  = "prod"
project_name = "realtime-collab"

# Set your actual AWS account ID before running terraform apply
account_id = "123456789012"

# Networking – prod uses 10.0.0.0/16
vpc_cidr = "10.0.0.0/16"

# Application images – updated by CI/CD pipeline on each deploy
core_backend_image     = ""
realtime_backend_image = ""

# DNS – production domain
domain_name = "app.yourdomain.com"

# Alerting – production alerts email
alert_email = "oncall@yourdomain.com"
